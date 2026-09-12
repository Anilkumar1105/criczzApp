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
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
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
