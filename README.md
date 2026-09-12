# Cricket Tournament Live Score — Setup Guide

A mobile-first cricket live-scoring app built with HTML, Bootstrap 5,
vanilla JavaScript, and Firebase (Authentication + Firestore only).
Every file sits in the root directory so it can be uploaded directly
to a GitHub repository and served with GitHub Pages.

## 1. Create your Firebase project

1. Go to https://console.firebase.google.com and create a new project.
2. In the project, click the **</> (web)** icon to register a web app.
3. Copy the `firebaseConfig` object it gives you.

## 2. Paste your config

Open **`firebase-config.js`** and replace the placeholder values inside
`firebaseConfig` with the values you copied:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};
```

That's the only file you need to edit before deploying.

## 3. Enable Authentication

Firebase Console → **Build → Authentication → Sign-in method** →
enable **Email/Password**.

## 4. Enable Firestore

Firebase Console → **Build → Firestore Database → Create database**.
Start in **production mode** (the rules below lock it down properly —
do NOT leave it in test mode).

## 5. Publish the security rules

Open **`firestore.rules`** in this project, copy the whole contents,
then go to Firebase Console → **Firestore Database → Rules**, paste it
in, and click **Publish**. (This file is a reference only — GitHub
Pages cannot serve/deploy Firestore rules for you; they must be
published from the Firebase Console or the Firebase CLI.)

## 6. Create your first admin account

Regular sign-ups from `login.html` always create a read-only **user**
account — that's intentional, so the public can't grant themselves
admin. To create an admin:

1. Sign up once through the app (`login.html` → "Create a viewer
   account") with the email you want to use as admin.
2. In Firebase Console → **Firestore Database**, open the `users`
   collection, find the document whose ID matches your new account's
   UID (Authentication tab shows the UID next to your email), and
   change its `role` field from `"user"` to `"admin"`.
3. Log out and back in — you'll land on `admin.html`.

Repeat step 2 for any other organizer accounts you want to promote.

## 7. Deploy to GitHub Pages

1. Create a new GitHub repository.
2. Upload **every file in this folder** to the repository root (don't
   put them in subfolders — the app expects a flat structure).
3. Go to the repo's **Settings → Pages**, set the source to the
   `main` branch / root, and save.
4. Your app will be live at `https://USERNAME.github.io/REPOSITORY/`.

## How the data model works

- `users/{uid}` — `{ name, email, role }`, role is `"admin"` or `"user"`.
- `tournaments/{id}`, `teams/{id}`, `players/{id}` — CRUD'd by admins,
  readable by everyone.
- `matches/{id}` — match metadata, playing XI, toss info, and the two
  innings' **live cache** (`innings1`, `innings2`): runs, wickets,
  overs, batting/bowling figures, current striker/non-striker/bowler,
  fall of wickets, last balls.
- `matches/{id}/balls/{ballId}` — one immutable document per ball ever
  bowled. The `innings1`/`innings2` cache on the match doc is rebuilt
  by replaying these ball events in order, which is what makes **Undo
  Ball** and **Edit Ball** simple and reliable: delete or edit an
  event, then recompute.

## Adding content

Because Firebase Storage is intentionally not used, all logos/photos
(tournament, team, player, banners) are plain **image URLs** you paste
in — host the images anywhere you like (e.g. imgur, your own site) and
paste the link into the relevant form.

## Pages overview

| File | Purpose |
|---|---|
| `login.html` | Email/password login + viewer sign-up |
| `index.html` | Home: live match, upcoming matches, teams, points link |
| `admin.html` | Admin dashboard with stats and quick actions |
| `tournament.html` | Admin: tournament CRUD |
| `teams.html` | Team list (public) + CRUD (admin) |
| `players.html` | Squad list (public) + CRUD (admin) |
| `matches.html` | Schedule (public) + match CRUD, playing XI, start match (admin) |
| `scoring.html` | Admin-only live scoring console (ball-by-ball) |
| `live-score.html` | Public match center: playing XI countdown / live score |
| `scorecard.html` | Full batting/bowling scorecard for a match |
| `points-table.html` | Points table with NRR |
| `settings.html` | Account info, logout, admin shortcut |
