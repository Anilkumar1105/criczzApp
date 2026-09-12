// ============================================================
// APP.JS — shared utilities: nav, formatting, toasts, cricket math
// ============================================================

import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- Firestore collection shortcuts ----------
export const col = {
  users: collection(db, "users"),
  tournaments: collection(db, "tournaments"),
  teams: collection(db, "teams"),
  players: collection(db, "players"),
  matches: collection(db, "matches"),
};

// simple in-memory cache so repeated lookups (team name, player name)
// don't hammer Firestore while rendering lists / scorecards.
const _cache = new Map();
export async function getDocCached(path, id) {
  const key = `${path}/${id}`;
  if (_cache.has(key)) return _cache.get(key);
  const snap = await getDoc(doc(db, path, id));
  const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  _cache.set(key, data);
  return data;
}
export function clearDocCache() {
  _cache.clear();
}

// ---------- Toasts ----------
export function toast(message, variant = "dark") {
  let holder = $("#toastHolder");
  if (!holder) {
    holder = document.createElement("div");
    holder.id = "toastHolder";
    holder.className = "toast-container position-fixed bottom-0 end-0 p-3";
    holder.style.zIndex = 1080;
    document.body.appendChild(holder);
  }
  const el = document.createElement("div");
  el.className = `toast align-items-center text-bg-${variant} border-0`;
  el.setAttribute("role", "alert");
  el.innerHTML = `<div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  holder.appendChild(el);
  const t = new bootstrap.Toast(el, { delay: 3200 });
  t.show();
  el.addEventListener("hidden.bs.toast", () => el.remove());
}

export function confirmAction(message) {
  return window.confirm(message);
}

// ---------- Formatting ----------
export function formatDate(value) {
  if (!value) return "-";
  const d = value?.toDate ? value.toDate() : new Date(value);
  if (isNaN(d)) return String(value);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "-";
  const d = value?.toDate ? value.toDate() : new Date(value);
  if (isNaN(d)) return String(value);
  return d.toLocaleString(undefined, {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

/** legalBalls (int) -> "9.2" style overs string */
export function ballsToOvers(legalBalls) {
  legalBalls = legalBalls || 0;
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

/** "9.2" or 9.2 style overs -> legal ball count (int) */
export function oversToBalls(overs) {
  if (overs === null || overs === undefined || overs === "") return 0;
  const str = String(overs);
  const [o, b] = str.split(".").map((n) => parseInt(n || "0", 10));
  return (o || 0) * 6 + (b || 0);
}

export function strikeRate(runs, balls) {
  if (!balls) return "0.00";
  return ((runs / balls) * 100).toFixed(2);
}

export function economy(runs, legalBalls) {
  if (!legalBalls) return "0.00";
  return (runs / (legalBalls / 6)).toFixed(2);
}

export function initials(name = "") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

// ---------- Navigation ----------
const USER_NAV = [
  { href: "index.html", icon: "bi-house-door-fill", label: "Home", key: "home" },
  { href: "matches.html", icon: "bi-controller", label: "Matches", key: "matches" },
  { href: "teams.html", icon: "bi-people-fill", label: "Teams", key: "teams" },
  { href: "points-table.html", icon: "bi-trophy-fill", label: "Points", key: "points" },
  { href: "settings.html", icon: "bi-list", label: "More", key: "more" },
];

export function renderBottomNav(activeKey) {
  const mount = $("#bottomNav");
  if (!mount) return;
  mount.innerHTML = `
    <nav class="bottom-nav">
      ${USER_NAV.map((item) => `
        <a href="${item.href}" class="bottom-nav-item ${item.key === activeKey ? "active" : ""}">
          <i class="bi ${item.icon}"></i>
          <span>${item.label}</span>
        </a>`).join("")}
    </nav>`;
}

const ADMIN_NAV = [
  { href: "admin.html", icon: "bi-speedometer2", label: "Dashboard", key: "dashboard" },
  { href: "tournament.html", icon: "bi-trophy", label: "Tournaments", key: "tournament" },
  { href: "teams.html", icon: "bi-people", label: "Teams", key: "teams" },
  { href: "players.html", icon: "bi-person-badge", label: "Players", key: "players" },
  { href: "matches.html", icon: "bi-calendar-event", label: "Matches", key: "matches" },
  { href: "scoring.html", icon: "bi-broadcast", label: "Live Scoring", key: "scoring" },
  { href: "settings.html", icon: "bi-gear", label: "Settings", key: "settings" },
];

export function renderAdminNav(activeKey) {
  const offcanvasBody = $("#adminNavList");
  if (!offcanvasBody) return;
  offcanvasBody.innerHTML = ADMIN_NAV.map((item) => `
    <a href="${item.href}" class="admin-nav-item ${item.key === activeKey ? "active" : ""}">
      <i class="bi ${item.icon}"></i> ${item.label}
    </a>`).join("");
}

export function renderTopbar(title, profile) {
  const t = $("#topbarTitle");
  if (t) t.textContent = title;
  const who = $("#topbarUser");
  if (who && profile) who.textContent = profile.name || profile.email || "";
}

// role badge / chip used on cards etc.
export function statusBadge(status) {
  const map = {
    UPCOMING: "secondary",
    PLAYING_XI: "info",
    LIVE: "danger",
    INNINGS_BREAK: "warning",
    COMPLETED: "success",
  };
  const cls = map[status] || "secondary";
  const label = (status || "").replace("_", " ");
  return `<span class="badge text-bg-${cls}">${status === "LIVE" ? '<i class="bi bi-broadcast"></i> ' : ""}${label}</span>`;
}
