// ============================================================
// TEAMS.JS — team CRUD (admin) + read/render helpers
// ============================================================

import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const teamsCol = collection(db, "teams");

export async function listTeams(tournamentId) {
  let q;
  if (tournamentId) {
    q = query(teamsCol, where("tournamentId", "==", tournamentId));
  } else {
    q = query(teamsCol, orderBy("name", "asc"));
  }
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return rows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export async function getTeam(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, "teams", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createTeam(data) {
  return addDoc(teamsCol, { ...data, createdAt: serverTimestamp() });
}

export async function updateTeam(id, data) {
  return updateDoc(doc(db, "teams", id), data);
}

export async function deleteTeam(id) {
  return deleteDoc(doc(db, "teams", id));
}

export function teamLogoImg(team, size = "") {
  const cls = `team-logo ${size}`.trim();
  if (team?.logoUrl) {
    return `<img src="${team.logoUrl}" class="${cls}" alt="${team.name || "Team"}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'${cls} avatar-fallback d-flex',textContent:'${(team.shortName || team.name || "?").slice(0, 3)}'}))">`;
  }
  return `<div class="${cls} avatar-fallback d-flex">${(team?.shortName || team?.name || "?").slice(0, 3)}</div>`;
}
