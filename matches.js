// ============================================================
// MATCHES.JS — match CRUD, playing XI, real-time listeners
// ============================================================

import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, onSnapshot, serverTimestamp,
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

export async function deleteMatch(id) {
  return deleteDoc(doc(db, "matches", id));
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
