# Cookify — Recipe-Sharing Platform

A full-stack recipe-sharing web application: user accounts with 2FA, a searchable/filterable recipe database, comments, ratings, saved recipes, subscriptions with email notifications, a ban system, basic chat, and multi-language support.

Built as a technical assignment. Backend in **Python (FastAPI)** rather than Java — language was confirmed flexible; Python was chosen to match my actual production experience. OOP requirements (inheritance/polymorphism for recipe categorization) are implemented via `Recipe` → `VegRecipe` / `NonVegRecipe` (see `backend/app/models/recipe.py`).

**A note on the frontend stack:** the assignment specifies plain HTML/CSS/JS. I originally built and verified that version first, then rebuilt it in **React** as a deliberate, explicit decision — not an oversight. The React version is now the one actively maintained and submitted; the original HTML/CSS/JS build has since been removed rather than left to drift out of sync with backend/behavior changes.

## Architecture

```
Cookify/
├── backend/               FastAPI + SQLAlchemy + SQLite (free, zero-config DB)
│   └── app/
│       ├── models/        User, Recipe (+ Veg/NonVeg subclasses), Rating, Comment,
│       │                  Subscription, SavedRecipe, ChatMessage, Warning
│       ├── routers/       auth, recipes, social (comments/ratings/subscriptions/saves),
│       │                  chat, users
│       └── services/      password hashing/JWT, content filtering, email (dev-mode fallback)
└── frontend-react/        React (Vite), served as a static build by the backend
    └── src/
        ├── pages/         Home, Login, Signup, ForgotPassword, Browse, Recipe,
        │                  Upload (doubles as Edit), Profile, Chat
        ├── components/    Layout, Navbar (+ Google Translate widget), Footer,
        │                  StarRating, StarPicker, PageLoading
        └── api.js         shared fetch-based API client
```

## Setup

**1. Build the React frontend** (one-time, or after any frontend change):
```bash
cd frontend-react
npm install
npm run build
```
This produces `frontend-react/dist/`, which the backend serves directly.

**2. Run the backend** — single process, single port, no separate frontend server or CORS config needed:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then open **http://localhost:8000/**. The SQLite database (`cookify.db`) is created automatically on first run.

The React app uses `BrowserRouter` for clean URLs (`/browse`, not `/#/browse`). The backend has a catch-all route that serves a real static file when one exists at that path (JS/CSS/assets) and falls back to `index.html` otherwise, so direct navigation and refreshes on any client-side route resolve correctly instead of 404ing. The API client calls same-origin relative paths, so this also works unchanged behind any real domain/port in production.

**Email:** set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` in `backend/.env` (gitignored) to send real emails — 2FA OTPs, comment/rating/subscription notifications, and ban warnings. Without them, `email_service.py` falls back to printing to the console so the app still runs with zero external setup.

## Design notes / honest tradeoffs

- **Chat is REST + polling, not WebSockets.** Simpler to reason about and test for a first version; WebSockets would give real-time push instead of a 4-second poll.
- **Content filtering is a small keyword list**, not a production moderation model — explicitly a baseline, documented in `content_filter.py`.
- **Email sends for real** via SMTP (see Setup above) when configured; falls back to console-logging with zero external setup otherwise.
- **Multi-language uses Google's Translate widget** rather than hand-translated strings, per the assignment's own test case wording ("compatible with Google's translation feature").
- **Ban system** wipes a user's comments/ratings/recipes on their 3rd warning, per the assignment's test case 11.
- **The Subscription flowchart/pseudocode opens with a `validateCommentSafe()` gate** ("Invalid comment detected – subscription denied"), but subscribing takes no comment input — the step appears to be carried over from the Commenting flow. Implementing it would mean validating a field that doesn't exist, so subscription goes straight to the subscriber-count/notify steps. The SFW filter it refers to *is* implemented, on commenting, where there's actually text to check.
- **`User.shareRecipe()` from the UML is client-side.** Sharing copies the recipe URL to the clipboard; it needs no server round-trip, so there's no backend method that would only ever forward a string. Every other UML method (`register`, `login`, `uploadRecipe`, `rateRecipe`, `Recipe.searchRecipe`, `Recipe.showRecipe`) is a real method on the model, called by the routers.

## Test coverage (matches the assignment's test table)

| Case | How to verify |
|---|---|
| Account creation | Sign up (includes phone number, per the Sign Up pseudocode) |
| Login + 2FA | Log in with username, email, *or* phone number — OTP is emailed for real (or printed to console if SMTP isn't configured) |
| Recipe upload/search/filter | Upload a recipe, then search/filter by ingredient, utensil, cost, time, calories, speed, difficulty, dietary tag, food type, cuisine, and rating |
| Veg/Non-veg + dietary dropdown | Browse page — "Veg only" toggle, plus the Vegetarian/Eggetarian/Pescetarian/Jain/Non-Vegetarian dropdown |
| Popularity sort | Sort by Popularity (driven by view count) |
| Commenting + NSFW filter | Try a comment containing a blocked word — it's rejected and the owner is warned |
| Rating | Click the star row on a recipe — the recipe owner gets notified by email |
| Edit / Share / Save recipe | On a recipe you own, "Edit recipe"; on any recipe, "Share Recipe" (copies link) and "Save Recipe" (shows up on your Profile) |
| Ban after 3 warnings | Post 3 blocked comments with the same account |
| Subscription + email | Subscribe to a creator (they're notified), then have them upload a new recipe (you're notified) |
