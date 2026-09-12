// ============================================================
// POINTS.JS — points table computed from completed matches
// ============================================================

import { listMatches } from "./matches.js";
import { listTeams } from "./teams.js";
import { getPlayersByIds } from "./players.js";

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

/**
 * Aggregate batting/bowling figures across every match that has started
 * (live or completed) in the tournament, for "Most Runs / Wickets / Fours
 * / Sixes" leaderboards.
 */
export async function computePlayerStats(tournamentId) {
  const [teams, matches] = await Promise.all([listTeams(tournamentId), listMatches(tournamentId)]);
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));
  const agg = {};
  const ensure = (id) => {
    if (!agg[id]) agg[id] = { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, matchIds: new Set() };
    return agg[id];
  };

  matches
    .filter((m) => m.innings1 || m.innings2)
    .forEach((m) => {
      [m.innings1, m.innings2].forEach((inn) => {
        if (!inn) return;
        Object.entries(inn.batsmen || {}).forEach(([pid, b]) => {
          const s = ensure(pid);
          s.runs += b.runs || 0;
          s.balls += b.balls || 0;
          s.fours += b.fours || 0;
          s.sixes += b.sixes || 0;
          s.teamId = s.teamId || inn.battingTeamId;
          s.matchIds.add(m.id);
        });
        Object.entries(inn.bowlers || {}).forEach(([pid, bw]) => {
          const s = ensure(pid);
          s.wickets += bw.wickets || 0;
          s.teamId = s.teamId || inn.bowlingTeamId;
          s.matchIds.add(m.id);
        });
      });
    });

  const playerIds = Object.keys(agg);
  const playersMap = await getPlayersByIds(playerIds);
  const rows = playerIds.map((id) => {
    const p = playersMap[id];
    const a = agg[id];
    const teamId = p?.teamId || a.teamId;
    return {
      playerId: id,
      name: p?.name || "Unknown",
      photoUrl: p?.photoUrl || "",
      teamId,
      teamShortName: teamMap[teamId]?.shortName || teamMap[teamId]?.name || "",
      matches: a.matchIds.size,
      runs: a.runs,
      balls: a.balls,
      fours: a.fours,
      sixes: a.sixes,
      wickets: a.wickets,
      strikeRate: a.balls > 0 ? ((a.runs / a.balls) * 100).toFixed(2) : "0.00",
    };
  });

  const topN = (key, n = 10) => [...rows].sort((x, y) => y[key] - x[key]).filter((r) => r[key] > 0).slice(0, n);

  return {
    topRuns: topN("runs"),
    topWickets: topN("wickets"),
    topFours: topN("fours"),
    topSixes: topN("sixes"),
  };
}
