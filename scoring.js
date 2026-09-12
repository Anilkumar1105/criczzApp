// ============================================================
// SCORING.JS — the cricket scoring engine
//
// Design: every ball bowled is written as an immutable event doc in
// matches/{matchId}/balls/{ballId}. The match document's innings1 /
// innings2 fields are a *derived cache* rebuilt by replaying all ball
// events for that innings in order (computeInningsState). This makes
// "Undo ball" and "Edit ball" trivial and bug-resistant: delete/edit
// the event, replay, write the result back. Ball counts per innings
// are small (<= ~300), so full replay on every write is cheap.
// ============================================================

import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, deleteDoc, updateDoc, getDoc, getDocs,
  query, orderBy, limit, runTransaction, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { ballsToOvers } from "./app.js";

export const MAX_WICKETS = 10;

export function maxLegalBalls(overs) {
  return (overs || 0) * 6;
}

function emptyBatsman() {
  return { runs: 0, balls: 0, fours: 0, sixes: 0, out: false, howOut: "", dismissedBy: "" };
}
function emptyBowler() {
  return { balls: 0, maidens: 0, runs: 0, wickets: 0 };
}

/**
 * Pure function: replay an ordered array of ball-event docs into a full
 * innings state (scores, batting/bowling figures, fall of wickets,
 * current striker/non-striker/bowler, last-balls list).
 */
export function computeInningsState(balls, opener) {
  const state = {
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    extras: { wide: 0, noball: 0, bye: 0, legbye: 0 },
    batsmen: {},
    bowlers: {},
    battingOrder: [],
    bowlingOrder: [],
    fallOfWickets: [],
    strikerId: opener?.strikerId || null,
    nonStrikerId: opener?.nonStrikerId || null,
    bowlerId: opener?.bowlerId || null,
    lastBalls: [], // most recent first, display strings
    complete: false,
  };

  const ensureBatsman = (id) => {
    if (!id) return;
    if (!state.batsmen[id]) {
      state.batsmen[id] = emptyBatsman();
      state.battingOrder.push(id);
    }
  };
  const ensureBowler = (id) => {
    if (!id) return;
    if (!state.bowlers[id]) {
      state.bowlers[id] = emptyBowler();
      state.bowlingOrder.push(id);
    }
  };

  ensureBatsman(state.strikerId);
  ensureBatsman(state.nonStrikerId);
  ensureBowler(state.bowlerId);

  let overRunsCharged = 0;

  const finishOverIfNeeded = (bowlerId) => {
    if (state.legalBalls > 0 && state.legalBalls % 6 === 0) {
      if (overRunsCharged === 0) state.bowlers[bowlerId].maidens += 1;
      overRunsCharged = 0;
      // strike rotates at the end of every over
      [state.strikerId, state.nonStrikerId] = [state.nonStrikerId, state.strikerId];
    }
  };

  for (const b of balls) {
    const striker = b.strikerId, nonStriker = b.nonStrikerId, bowlerId = b.bowlerId;
    ensureBatsman(striker);
    ensureBatsman(nonStriker);
    ensureBowler(bowlerId);
    let display = "";

    if (b.ballType === "run") {
      const r = b.runs || 0;
      state.batsmen[striker].runs += r;
      state.batsmen[striker].balls += 1;
      if (r === 4) state.batsmen[striker].fours += 1;
      if (r === 6) state.batsmen[striker].sixes += 1;
      state.bowlers[bowlerId].balls += 1;
      state.bowlers[bowlerId].runs += r;
      overRunsCharged += r;
      state.runs += r;
      state.legalBalls += 1;
      display = String(r);
      if (r % 2 === 1) [state.strikerId, state.nonStrikerId] = [state.nonStrikerId, state.strikerId];
      finishOverIfNeeded(bowlerId);
    } else if (b.ballType === "wide") {
      const extra = 1 + (b.runs || 0);
      state.extras.wide += extra;
      state.bowlers[bowlerId].runs += extra;
      state.runs += extra;
      overRunsCharged += extra;
      display = b.runs ? `Wd+${b.runs}` : "Wd";
      if ((b.runs || 0) % 2 === 1) [state.strikerId, state.nonStrikerId] = [state.nonStrikerId, state.strikerId];
      // not a legal delivery — over does not advance
    } else if (b.ballType === "noball") {
      const batRuns = b.runs || 0;
      state.extras.noball += 1;
      state.bowlers[bowlerId].runs += 1 + batRuns;
      state.batsmen[striker].runs += batRuns;
      if (batRuns === 4) state.batsmen[striker].fours += 1;
      if (batRuns === 6) state.batsmen[striker].sixes += 1;
      state.runs += 1 + batRuns;
      overRunsCharged += 1 + batRuns;
      display = batRuns ? `Nb+${batRuns}` : "Nb";
      if (batRuns % 2 === 1) [state.strikerId, state.nonStrikerId] = [state.nonStrikerId, state.strikerId];
      // not a legal delivery — over does not advance
    } else if (b.ballType === "bye" || b.ballType === "legbye") {
      const r = b.runs || 1;
      const key = b.ballType === "bye" ? "bye" : "legbye";
      state.extras[key] += r;
      state.batsmen[striker].balls += 1;
      state.runs += r;
      state.bowlers[bowlerId].balls += 1;
      overRunsCharged += r;
      state.legalBalls += 1;
      display = `${b.ballType === "bye" ? "B" : "LB"}${r}`;
      if (r % 2 === 1) [state.strikerId, state.nonStrikerId] = [state.nonStrikerId, state.strikerId];
      finishOverIfNeeded(bowlerId);
    } else if (b.ballType === "wicket") {
      const runsCompleted = b.runs || 0;
      const isRunOut = b.wicketType === "Run Out";
      const isRetired = b.wicketType === "Retired";
      state.batsmen[striker].balls += 1;
      if (runsCompleted) {
        state.batsmen[striker].runs += runsCompleted;
        if (runsCompleted === 4) state.batsmen[striker].fours += 1;
        if (runsCompleted === 6) state.batsmen[striker].sixes += 1;
        state.runs += runsCompleted;
      }
      state.bowlers[bowlerId].balls += 1;
      if (!isRunOut && !isRetired) state.bowlers[bowlerId].wickets += 1;
      overRunsCharged += 0;
      state.legalBalls += 1;

      const dismissedId = b.dismissedPlayerId || striker;
      state.batsmen[dismissedId].out = true;
      state.batsmen[dismissedId].howOut = b.wicketType || "";
      state.batsmen[dismissedId].dismissedBy = b.wicketType === "Run Out" ? "" : bowlerId;
      if (!isRetired) {
        state.wickets += 1;
        state.fallOfWickets.push({
          score: state.runs, wicketNum: state.wickets, over: ballsToOvers(state.legalBalls), playerId: dismissedId,
        });
      }
      display = "W";

      // apply strike rotation for completed runs first
      if (runsCompleted % 2 === 1) [state.strikerId, state.nonStrikerId] = [state.nonStrikerId, state.strikerId];

      // bring in the new batsman at the dismissed player's crease
      if (b.newBatsmanId) {
        ensureBatsman(b.newBatsmanId);
        if (state.strikerId === dismissedId) state.strikerId = b.newBatsmanId;
        else if (state.nonStrikerId === dismissedId) state.nonStrikerId = b.newBatsmanId;
      } else if (state.strikerId === dismissedId || state.nonStrikerId === dismissedId) {
        // no replacement given (all out) — leave as-is, innings will be marked complete
        if (state.strikerId === dismissedId) state.strikerId = null;
        if (state.nonStrikerId === dismissedId) state.nonStrikerId = null;
      }

      finishOverIfNeeded(bowlerId);
    }

    state.bowlerId = bowlerId;
    state.lastBalls.unshift({ display, isWicket: b.ballType === "wicket", isBoundary: display === "4" || display === "6" });
  }

  state.lastBalls = state.lastBalls.slice(0, 12);
  return state;
}

/** Get the next ball sequence number for an innings, atomically. */
async function nextBallSeq(matchId) {
  const matchRef = doc(db, "matches", matchId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(matchRef);
    const current = snap.data()?.ballSeqCounter || 0;
    tx.update(matchRef, { ballSeqCounter: current + 1 });
    return current + 1;
  });
}

async function getBallsForInnings(matchId, inningsNumber) {
  const q = query(
    collection(db, "matches", matchId, "balls"),
    orderBy("seq", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((b) => b.inningsNumber === inningsNumber);
}

/** Recompute innings state from stored balls and write it back to the match doc. */
export async function recomputeAndSave(matchId, inningsNumber, opener) {
  const balls = await getBallsForInnings(matchId, inningsNumber);
  const state = computeInningsState(balls, opener);
  const matchRef = doc(db, "matches", matchId);
  const matchSnap = await getDoc(matchRef);
  const match = matchSnap.data();
  const inningsKey = `innings${inningsNumber}`;
  const overs = match.overs;
  const wicketsAllOut = state.wickets >= MAX_WICKETS;
  const oversDone = state.legalBalls >= maxLegalBalls(overs);
  const targetReached = inningsNumber === 2 && match.innings1 && state.runs >= (match.innings1.runs + 1);
  const inningsComplete = wicketsAllOut || oversDone || targetReached;

  // Preserve battingTeamId/bowlingTeamId (and anything else not part of the
  // replayed state) — computeInningsState only returns score/figures, so a
  // plain overwrite here would silently wipe those fields after the very
  // first ball of the innings.
  const existingInnings = match[inningsKey] || {};
  const update = {
    [inningsKey]: {
      ...existingInnings,
      ...state,
      battingTeamId: existingInnings.battingTeamId,
      bowlingTeamId: existingInnings.bowlingTeamId,
      complete: inningsComplete,
    },
  };

  if (inningsComplete && inningsNumber === 1) {
    update.status = "INNINGS_BREAK";
  }
  if (inningsComplete && inningsNumber === 2) {
    update.status = "COMPLETED";
    update.result = await computeResultText(match, { ...state, complete: true });
  }

  await updateDoc(matchRef, update);
  return state;
}

export async function computeResultText(match, innings2State) {
  const t1 = match.innings1?.runs ?? 0;
  const t2 = innings2State?.runs ?? match.innings2?.runs ?? 0;
  let team1Name = "Team A", team2Name = "Team B";
  try {
    const [aSnap, bSnap] = await Promise.all([
      getDoc(doc(db, "teams", match.teamAId)),
      getDoc(doc(db, "teams", match.teamBId)),
    ]);
    if (aSnap.exists()) team1Name = aSnap.data().name || team1Name;
    if (bSnap.exists()) team2Name = bSnap.data().name || team2Name;
  } catch (e) { /* fall back to generic names */ }
  const battingFirstName = match.innings1?.battingTeamId === match.teamAId ? team1Name : team2Name;
  const battingSecondName = battingFirstName === team1Name ? team2Name : team1Name;
  const wicketsLeft = MAX_WICKETS - (innings2State?.wickets ?? 0);
  if (t2 > t1) return `${battingSecondName} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}`;
  if (t1 > t2) return `${battingFirstName} won by ${t1 - t2} run${t1 - t2 === 1 ? "" : "s"}`;
  return "Match tied";
}

/**
 * Record one ball event and recompute the innings. `payload` fields:
 * inningsNumber, ballType, runs, strikerId, nonStrikerId, bowlerId,
 * wicketType, dismissedPlayerId, newBatsmanId
 */
export async function recordBall(matchId, payload) {
  const seq = await nextBallSeq(matchId);
  await addDoc(collection(db, "matches", matchId, "balls"), {
    ...payload,
    seq,
    timestamp: serverTimestamp(),
  });
  const opener = await getInningsOpener(matchId, payload.inningsNumber);
  return recomputeAndSave(matchId, payload.inningsNumber, opener);
}

/** The fixed starting point (openers) recorded when an innings begins. */
async function getInningsOpener(matchId, inningsNumber) {
  const snap = await getDoc(doc(db, "matches", matchId));
  const match = snap.data();
  const key = `innings${inningsNumber}Opener`;
  return match[key] || null;
}

export async function undoLastBall(matchId, inningsNumber) {
  const q = query(
    collection(db, "matches", matchId, "balls"),
    orderBy("seq", "desc"),
    limit(20)
  );
  const snap = await getDocs(q);
  const lastOfInnings = snap.docs.find((d) => d.data().inningsNumber === inningsNumber);
  if (!lastOfInnings) throw new Error("No balls to undo in this innings.");
  await deleteDoc(lastOfInnings.ref);
  const opener = await getInningsOpener(matchId, inningsNumber);
  return recomputeAndSave(matchId, inningsNumber, opener);
}

export async function editBall(matchId, ballId, inningsNumber, updatedFields) {
  await updateDoc(doc(db, "matches", matchId, "balls", ballId), updatedFields);
  const opener = await getInningsOpener(matchId, inningsNumber);
  return recomputeAndSave(matchId, inningsNumber, opener);
}

export async function getAllBalls(matchId) {
  const q = query(collection(db, "matches", matchId, "balls"), orderBy("seq", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Start an innings: sets openers + batting/bowling teams on the match doc. */
export async function startInnings(matchId, inningsNumber, { strikerId, nonStrikerId, bowlerId, battingTeamId, bowlingTeamId }) {
  const opener = { strikerId, nonStrikerId, bowlerId };
  const update = {
    [`innings${inningsNumber}Opener`]: opener,
    [`innings${inningsNumber}`]: {
      ...computeInningsState([], opener),
      battingTeamId, bowlingTeamId, complete: false,
    },
    status: "LIVE",
    currentInnings: inningsNumber,
  };
  if (inningsNumber === 1) update.ballSeqCounter = update.ballSeqCounter || 0;
  await updateDoc(doc(db, "matches", matchId), update);
}

export async function beginSecondInnings(matchId) {
  await updateDoc(doc(db, "matches", matchId), { status: "INNINGS_BREAK", currentInnings: 2 });
}

export async function markMatchComplete(matchId, resultText) {
  await updateDoc(doc(db, "matches", matchId), { status: "COMPLETED", result: resultText });
}

/** Admin can manually declare/end an innings early (before overs or all-out). */
export async function forceEndInnings(matchId, inningsNumber) {
  const matchRef = doc(db, "matches", matchId);
  const snap = await getDoc(matchRef);
  const match = snap.data();
  const key = `innings${inningsNumber}`;
  const innings = { ...match[key], complete: true };
  const update = { [key]: innings };
  if (inningsNumber === 1) {
    update.status = "INNINGS_BREAK";
  } else {
    update.status = "COMPLETED";
    update.result = await computeResultText(match, innings);
  }
  await updateDoc(matchRef, update);
}
