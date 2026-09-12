// ============================================================
// MATCHES.JS — match CRUD, playing XI, real-time listeners
// ============================================================

import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, onSnapshot, serverTimestamp, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const matchesCol = collection(db, "matches");

export const STATUSES = ["UPCOMING", "PLAYING_XI", "LIVE", "INNINGS_BREAK", "COMPLETED"];

export async function listMatches(tournamentId) {
  let rows;
  if (tournamentId) {
    const snap = await getDocs(query(matchesCol, where("tournamentId", "==", tournamentId)));
    rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } else {
    const snap = await getDocs(matchesCol);
    rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return rows.sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
}

export async function getMatch(id) {
  const snap = await getDoc(doc(db, "matches", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createMatch(data) {
  return addDoc(matchesCol, {
    ...data,
    status: "UPCOMING",
    playingXI: {},
    playingXIAnnounced: false,
    currentInnings: 0,
    ballSeqCounter: 0,
    createdAt: serverTimestamp(),
  });
}

export async function updateMatch(id, data) {
  return updateDoc(doc(db, "matches", id), data);
}

/**
 * Delete a match AND every ball-by-ball event stored under it
 * (matches/{id}/balls/*). Firestore does not cascade-delete
 * subcollections automatically, so without this the ball log — and
 * therefore the match's live/final score data — would be orphaned
 * in the database forever even after the match "disappears" from
 * the app.
 */
export async function deleteMatch(id) {
  const ballsSnap = await getDocs(collection(db, "matches", id, "balls"));
  const ballDocs = ballsSnap.docs;
  const CHUNK = 400; // stay under Firestore's 500-writes-per-batch limit
  for (let i = 0; i < ballDocs.length; i += CHUNK) {
    const batch = writeBatch(db);
    ballDocs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, "matches", id));
}

export function listenMatch(id, callback) {
  return onSnapshot(doc(db, "matches", id), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export function listenAllMatches(callback) {
  return onSnapshot(matchesCol, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
    callback(rows);
  });
}

// ---------- Playing XI ----------
export async function setPlayingXI(matchId, teamId, playerIds) {
  const match = await getMatch(matchId);
  const playingXI = { ...(match.playingXI || {}), [teamId]: playerIds };
  const bothSet = match.teamAId && match.teamBId &&
    playingXI[match.teamAId]?.length === 11 && playingXI[match.teamBId]?.length === 11;
  await updateMatch(matchId, {
    playingXI,
    status: bothSet ? "PLAYING_XI" : match.status,
  });
}

export async function setPlayingXIAnnounceTime(matchId, announceAtISOString) {
  await updateMatch(matchId, {
    playingXIAnnounceAt: announceAtISOString ? new Date(announceAtISOString).toISOString() : null,
  });
}

export async function announcePlayingXI(matchId) {
  await updateMatch(matchId, { playingXIAnnounced: true });
}

export async function setToss(matchId, tossWinnerTeamId, tossDecision) {
  await updateMatch(matchId, { tossWinnerTeamId, tossDecision });
}
