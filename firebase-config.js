// ============================================================
// FIREBASE CONFIGURATION
// ============================================================
// PASTE YOUR FIREBASE PROJECT CONFIG BELOW.
//
// Where to find it:
//   Firebase Console -> Project settings (gear icon) -> General tab
//   -> "Your apps" -> Web app -> SDK setup and configuration -> Config
//
// Replace the placeholder values ONLY inside firebaseConfig.
// Do not change the import lines or the exported names below.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ---------- PASTE YOUR CONFIG HERE ----------
const firebaseConfig = {
  apiKey: "AIzaSyCZZP5VxjyLmIy3fIXiP_sCrMR1jIF6LTI",
  authDomain: "cricketapp-c1273.firebaseapp.com",
  projectId: "cricketapp-c1273",
  storageBucket: "cricketapp-c1273.firebasestorage.app",
  messagingSenderId: "835964581502",
  appId: "1:835964581502:web:690293aa6a3e0bd0824a2f",
  measurementId: "G-1930RJM5KK"
};
// ---------------------------------------------

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Keep users logged in across page reloads (needed since every page
// is a separate static HTML file with its own JS context).
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Auth persistence error:", err);
});
