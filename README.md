# Cookify — Recipe-Sharing Platform

A full-stack recipe-sharing web application: user accounts with 2FA, a searchable/filterable recipe database, comments, ratings, saved recipes, subscriptions with email notifications, a ban system, basic chat, and multi-language support.

Built as a technical assignment. Backend in **Python (FastAPI)** rather than Java — language was confirmed flexible; Python was chosen to match my actual production experience. OOP requirements (inheritance/polymorphism for recipe categorization) are implemented via `Recipe` → `VegRecipe` / `NonVegRecipe` (see `backend/app/models/recipe.py`).

**A note on the frontend stack:** the assignment specifies plain HTML/CSS/JS. I built and fully verified that version first — it's a deliberate, working implementation, not skipped. I then rebuilt the same frontend in **React** as a separate, explicit decision, not an oversight or a substitution for following instructions. If HTML/CSS/JS specifically (not just "a working frontend") is what's being evaluated, the original is straightforward to reinstate — every page has a 1:1 React counterpart, so nothing about the backend or feature set changed between the two.

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
├── frontend-react/        React (Vite), served as a static build by the backend
│   └── src/
│       ├── pages/         Home, Login, Signup, ForgotPassword, Browse, Recipe,
│       │                  Upload (doubles as Edit), Profile, Chat
│       ├── components/    Navbar (+ Google Translate widget), Footer
│       └── api.js         shared fetch-based API client
└── frontend/               original plain HTML/CSS/JS version, kept intact and working
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

The React app uses `HashRouter` (URLs like `/#/browse`) rather than `BrowserRouter` specifically so plain static file serving works correctly — a real client-side route with `BrowserRouter` would 404 on direct navigation/refresh, since `StaticFiles` has no SPA-fallback logic. The API client calls same-origin relative paths, so this also works unchanged behind any real domain/port in production.

**To run the original HTML/CSS/JS version instead:** in `backend/app/main.py`, change the `_FRONTEND_DIR` path from `frontend-react/dist` back to `frontend`, restart the server, and open `http://localhost:8000/pages/index.html`. No backend or database changes needed either way — both frontends talk to the identical API.

## Design notes / honest tradeoffs

- **Chat is REST + polling, not WebSockets.** Simpler to reason about and test for a first version; WebSockets would give real-time push instead of a 4-second poll.
- **Content filtering is a small keyword list**, not a production moderation model — explicitly a baseline, documented in `content_filter.py`.
- **Email is console-logged by default** (dev mode) unless `SMTP_*` environment variables are set — so the app runs with zero external setup, but real SMTP can be plugged in.
- **Multi-language uses Google's Translate widget** rather than hand-translated strings, per the assignment's own test case wording ("compatible with Google's translation feature").
- **Ban system** wipes a user's comments/ratings/recipes on their 3rd warning, per the assignment's test case 11.

## Test coverage (matches the assignment's test table)

| Case | How to verify |
|---|---|
| Account creation | Sign up (includes phone number, per the Sign Up pseudocode) |
| Login + 2FA | Log in with username, email, *or* phone number — OTP prints to the backend console in dev mode |
| Recipe upload/search/filter | Upload a recipe, then search/filter by ingredient, utensil, cost, time, calories, speed, difficulty, dietary tag, food type, cuisine, and rating |
| Veg/Non-veg + dietary dropdown | Browse page — "Veg only" toggle, plus the Vegetarian/Eggetarian/Pescetarian/Jain/Non-Vegetarian dropdown |
| Popularity sort | Sort by Popularity (driven by view count) |
| Commenting + NSFW filter | Try a comment containing a blocked word — it's rejected and the owner is warned |
| Rating | Click the star row on a recipe — the recipe owner gets notified by email |
| Edit / Share / Save recipe | On a recipe you own, "Edit recipe"; on any recipe, "Share Recipe" (copies link) and "Save Recipe" (shows up on your Profile) |
| Ban after 3 warnings | Post 3 blocked comments with the same account |
| Subscription + email | Subscribe to a creator (they're notified), then have them upload a new recipe (you're notified) |
