// ============================================================
// PLAYERS.JS — player CRUD (admin) + read/render helpers
// ============================================================

import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const playersCol = collection(db, "players");

export async function listPlayers(teamId) {
  let rows;
  if (teamId) {
    const snap = await getDocs(query(playersCol, where("teamId", "==", teamId)));
    rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } else {
    const snap = await getDocs(playersCol);
    rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return rows.sort((a, b) => (a.jerseyNumber || 0) - (b.jerseyNumber || 0));
}

export async function getPlayer(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, "players", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getPlayersByIds(ids = []) {
  const unique = [...new Set(ids.filter(Boolean))];
  const results = await Promise.all(unique.map((id) => getPlayer(id)));
  const map = {};
  results.forEach((p) => { if (p) map[p.id] = p; });
  return map;
}

export async function createPlayer(data) {
  return addDoc(playersCol, { ...data, createdAt: serverTimestamp() });
}

export async function updatePlayer(id, data) {
  return updateDoc(doc(db, "players", id), data);
}

export async function deletePlayer(id) {
  return deleteDoc(doc(db, "players", id));
}

export function playerPhotoImg(player, size = "") {
  const cls = `team-logo ${size}`.trim();
  const initials = (player?.name || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  if (player?.photoUrl) {
    return `<img src="${player.photoUrl}" class="${cls}" alt="${player.name}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'${cls} avatar-fallback d-flex',textContent:'${initials}'}))">`;
  }
  return `<div class="${cls} avatar-fallback d-flex">${initials}</div>`;
}

export const PLAYER_ROLES = ["Batsman", "Bowler", "All-rounder", "Wicket Keeper"];
