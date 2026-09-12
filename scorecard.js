// ============================================================
// SCORECARD.JS — render batting/bowling scorecards from innings state
// ============================================================

import { ballsToOvers, strikeRate, economy } from "./app.js";
import { playerPhotoImg } from "./players.js";

/**
 * innings: the computed innings state (see scoring.js computeInningsState)
 * playersMap: { playerId: playerDoc }
 */
export function renderBattingTable(innings, playersMap) {
  if (!innings || !innings.battingOrder?.length) {
    return `<p class="text-muted small mb-0">Batting has not started yet.</p>`;
  }
  const rows = innings.battingOrder.map((pid) => {
    const p = playersMap[pid] || { name: "Unknown" };
    const b = innings.batsmen[pid] || { runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
    const isCurrent = pid === innings.strikerId || pid === innings.nonStrikerId;
    const status = b.out
      ? `<span class="text-muted small">${describeDismissal(b, playersMap)}</span>`
      : isCurrent
        ? `<span class="text-success small fw-semibold">not out${pid === innings.strikerId ? " *" : ""}</span>`
        : `<span class="text-muted small">not out</span>`;
    return `<tr>
      <td>
        <div class="fw-semibold">${p.name || "Unknown"}</div>
        ${status}
      </td>
      <td class="text-end fw-bold">${b.runs}</td>
      <td class="text-end">${b.balls}</td>
      <td class="text-end">${b.fours}</td>
      <td class="text-end">${b.sixes}</td>
      <td class="text-end">${strikeRate(b.runs, b.balls)}</td>
    </tr>`;
  }).join("");

  return `<div class="table-responsive">
    <table class="table table-sm points-table mb-2">
      <thead><tr><th>Batter</th><th class="text-end">R</th><th class="text-end">B</th><th class="text-end">4s</th><th class="text-end">6s</th><th class="text-end">SR</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function describeDismissal(b, playersMap) {
  if (!b.out) return "not out";
  const bowlerName = b.dismissedBy ? (playersMap[b.dismissedBy]?.name || "") : "";
  switch (b.howOut) {
    case "Bowled": return `b ${bowlerName}`;
    case "Caught": return `c ${bowlerName}`;
    case "LBW": return `lbw b ${bowlerName}`;
    case "Stumped": return `st b ${bowlerName}`;
    case "Hit Wicket": return `hit wicket b ${bowlerName}`;
    case "Run Out": return `run out`;
    case "Retired": return `retired hurt`;
    default: return b.howOut || "out";
  }
}

export function renderBowlingTable(innings, playersMap) {
  if (!innings || !innings.bowlingOrder?.length) {
    return `<p class="text-muted small mb-0">No bowling yet.</p>`;
  }
  const rows = innings.bowlingOrder.map((pid) => {
    const p = playersMap[pid] || { name: "Unknown" };
    const bw = innings.bowlers[pid] || { balls: 0, maidens: 0, runs: 0, wickets: 0 };
    return `<tr>
      <td class="fw-semibold">${p.name || "Unknown"}</td>
      <td class="text-end">${ballsToOvers(bw.balls)}</td>
      <td class="text-end">${bw.maidens}</td>
      <td class="text-end">${bw.runs}</td>
      <td class="text-end fw-bold">${bw.wickets}</td>
      <td class="text-end">${economy(bw.runs, bw.balls)}</td>
    </tr>`;
  }).join("");

  return `<div class="table-responsive">
    <table class="table table-sm points-table mb-2">
      <thead><tr><th>Bowler</th><th class="text-end">O</th><th class="text-end">M</th><th class="text-end">R</th><th class="text-end">W</th><th class="text-end">ECO</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

export function renderExtras(innings) {
  if (!innings) return "";
  const e = innings.extras || { wide: 0, noball: 0, bye: 0, legbye: 0 };
  const total = e.wide + e.noball + e.bye + e.legbye;
  return `<div class="d-flex justify-content-between small text-muted border-top pt-2 mt-1">
    <span>Extras</span>
    <span>${total} <span class="text-muted">(wd ${e.wide}, nb ${e.noball}, b ${e.bye}, lb ${e.legbye})</span></span>
  </div>`;
}

export function renderFallOfWickets(innings, playersMap) {
  if (!innings || !innings.fallOfWickets?.length) return "";
  const items = innings.fallOfWickets.map((f) =>
    `${f.score}-${f.wicketNum} (${(playersMap[f.playerId]?.name || "?")}, ${f.over} ov)`
  ).join(", ");
  return `<div class="small text-muted mt-2"><strong>Fall of wickets:</strong> ${items}</div>`;
}

export function renderInningsTotal(innings, teamName) {
  if (!innings) return "";
  return `<div class="d-flex justify-content-between align-items-baseline mb-2">
    <h5 class="mb-0">${teamName || "Team"}</h5>
    <div class="display-font fw-bold fs-4">${innings.runs}/${innings.wickets} <small class="fs-6 text-muted">(${ballsToOvers(innings.legalBalls)} ov)</small></div>
  </div>`;
}
