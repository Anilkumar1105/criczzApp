// ============================================================
// AUTH.JS — shared authentication + role helpers
// Loaded (as a module) by every page after firebase-config.js
// ============================================================

import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/**
 * Fetch the role document for a signed-in user.
 * Returns { name, email, role } or null if no profile doc exists.
 */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * Fires callback(user, profile) whenever auth state changes.
 * profile is null if signed out, or if no users/{uid} doc exists.
 */
export function onAuthReady(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null, null);
      return;
    }
    try {
      const profile = await getUserProfile(user.uid);
      callback(user, profile);
    } catch (err) {
      console.error("Failed to load user profile:", err);
      callback(user, null);
    }
  });
}

/**
 * Guard a page: redirects if the signed-in user's role doesn't match.
 * requiredRole: "admin" | "user" | "any"
 * Returns a Promise that resolves with { user, profile } when allowed.
 */
export function requireRole(requiredRole) {
  return new Promise((resolve) => {
    onAuthReady((user, profile) => {
      if (!user || !profile) {
        window.location.href = "login.html";
        return;
      }
      if (requiredRole === "admin" && profile.role !== "admin") {
        window.location.href = "index.html";
        return;
      }
      resolve({ user, profile });
    });
  });
}

export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getUserProfile(cred.user.uid);
  if (!profile) {
    // No role doc yet -> treat as a normal viewer and create one.
    await setDoc(doc(db, "users", cred.user.uid), {
      name: cred.user.email.split("@")[0],
      email: cred.user.email,
      role: "user",
      createdAt: serverTimestamp(),
    });
    return { role: "user" };
  }
  return profile;
}

/** Public self-signup always creates a read-only "user" account. */
export async function signupUser(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "users", cred.user.uid), {
    name: name || email.split("@")[0],
    email,
    role: "user",
    createdAt: serverTimestamp(),
  });
  return { role: "user" };
}

export async function logoutUser() {
  await signOut(auth);
  window.location.href = "login.html";
}

/** Human-readable text for common Firebase Auth error codes. */
export function authErrorMessage(err) {
  const map = {
    "auth/invalid-email": "That email address looks invalid.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/email-already-in-use": "An account already exists for that email.",
    "auth/weak-password": "Password should be at least 6 characters.",
  };
  return map[err.code] || err.message || "Something went wrong.";
}
