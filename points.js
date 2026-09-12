// ============================================================
// POINTS.JS — points table computed from completed matches
// ============================================================

import { listMatches } from "./matches.js";
import { listTeams } from "./teams.js";

const WIN_POINTS = 2;
const TIE_POINTS = 1;
const NO_RESULT_POINTS = 1;

function blankRow(team) {
  return {
    teamId: team.id,
    name: team.name,
    shortName: team.shortName,
    logoUrl: team.logoUrl,
    played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0,
    runsFor: 0, oversFor: 0, runsAgainst: 0, oversAgainst: 0,
  };
}

/** overs used for NRR: full quota if the innings ended all-out before overs ran out. */
function nrrOvers(innings, allottedOvers) {
  if (!innings) return 0;
  const wicketsAllOut = innings.wickets >= 10;
  return wicketsAllOut ? allottedOvers : innings.legalBalls / 6;
}

export async function computeStandings(tournamentId) {
  const [teams, matches] = await Promise.all([listTeams(tournamentId), listMatches(tournamentId)]);
  const rows = {};
  teams.forEach((t) => { rows[t.id] = blankRow(t); });

  matches
    .filter((m) => m.status === "COMPLETED" && m.innings1 && m.innings2)
    .forEach((m) => {
      const teamAId = m.teamAId, teamBId = m.teamBId;
      if (!rows[teamAId] || !rows[teamBId]) return;
      const aIsInnings1 = m.innings1.battingTeamId === teamAId;
      const aInnings = aIsInnings1 ? m.innings1 : m.innings2;
      const bInnings = aIsInnings1 ? m.innings2 : m.innings1;

      rows[teamAId].played += 1;
      rows[teamBId].played += 1;
      rows[teamAId].runsFor += aInnings.runs;
      rows[teamAId].runsAgainst += bInnings.runs;
      rows[teamBId].runsFor += bInnings.runs;
      rows[teamBId].runsAgainst += aInnings.runs;
      rows[teamAId].oversFor += nrrOvers(aInnings, m.overs);
      rows[teamAId].oversAgainst += nrrOvers(bInnings, m.overs);
      rows[teamBId].oversFor += nrrOvers(bInnings, m.overs);
      rows[teamBId].oversAgainst += nrrOvers(aInnings, m.overs);

      if (aInnings.runs === bInnings.runs) {
        rows[teamAId].tied += 1; rows[teamBId].tied += 1;
        rows[teamAId].points += TIE_POINTS; rows[teamBId].points += TIE_POINTS;
      } else if (aInnings.runs > bInnings.runs) {
        rows[teamAId].won += 1; rows[teamAId].points += WIN_POINTS;
        rows[teamBId].lost += 1;
      } else {
        rows[teamBId].won += 1; rows[teamBId].points += WIN_POINTS;
        rows[teamAId].lost += 1;
      }
    });

  const list = Object.values(rows).map((r) => {
    const nrr = (r.oversFor > 0 ? r.runsFor / r.oversFor : 0) - (r.oversAgainst > 0 ? r.runsAgainst / r.oversAgainst : 0);
    return { ...r, nrr };
  });

  list.sort((a, b) => b.points - a.points || b.nrr - a.nrr);
  return list;
}
