// ============================================================
// TOURNAMENT.JS — tournament CRUD (admin) + read helpers
// ============================================================

import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const tournamentsCol = collection(db, "tournaments");

export async function listTournaments() {
  const snap = await getDocs(query(tournamentsCol, orderBy("startDate", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getTournament(id) {
  const snap = await getDoc(doc(db, "tournaments", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createTournament(data) {
  return addDoc(tournamentsCol, { ...data, createdAt: serverTimestamp() });
}

export async function updateTournament(id, data) {
  return updateDoc(doc(db, "tournaments", id), data);
}

export async function deleteTournament(id) {
  return deleteDoc(doc(db, "tournaments", id));
}

/** Convenience: the most recently created tournament, used as a default context. */
export async function getDefaultTournament() {
  const all = await listTournaments();
  return all[0] || null;
}
