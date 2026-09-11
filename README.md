# Cookify — Recipe-Sharing Platform

A full-stack recipe-sharing web application: user accounts secured with an emailed 6-digit 2FA code at login, a searchable/filterable recipe database (image *and* video), comments with NSFW filtering, ratings, saved recipes, a "Following" feed, subscriptions with email notifications, a ban-after-3-warnings system, real-time-ish chat with unread indicators, a real emailed password-reset flow, and multi-language support.

Built as a technical assignment. Backend in **Python (FastAPI)** rather than Java — language was confirmed flexible; Python was chosen to match my actual production experience. OOP requirements (inheritance/polymorphism for recipe categorization) are implemented via `Recipe` → `VegRecipe` / `NonVegRecipe` (see `backend/app/models/recipe.py`), a real polymorphic hierarchy, not a boolean flag pretending to be one.

**A note on the frontend stack:** the assignment specifies plain HTML/CSS/JS. The React version is the one actively maintained and submitted — the original plain-JS build was removed rather than left to drift out of sync with backend/behavior changes.

## Architecture

```
Cookify/
├── backend/               FastAPI + SQLAlchemy, Postgres (Neon) or SQLite
│   └── app/
│       ├── models/        User, Recipe (+ VegRecipe/NonVegRecipe), Rating, Comment,
│       │                  Subscription, SavedRecipe, ChatMessage, Warning
│       ├── routers/       auth, recipes, social (comments/ratings/subscriptions/saves),
│       │                  chat, users
│       └── services/      security (hashing/JWT), media (upload validation),
│                          content_filter (NSFW), email_service (incl. login OTP)
└── frontend-react/        React (Vite)
    └── src/
        ├── pages/         Home, Login, Signup, ForgotPassword, About, Browse, Recipe,
        │                  Upload (doubles as Edit), Profile, Messages, Chat
        ├── components/    Layout, Navbar, Footer, Avatar (image/video-or-initial,
        │                  used everywhere a picture might not exist), Modal, ShareModal,
        │                  StarRating, StarPicker, PageLoading
        ├── hooks/         useConfirm, useToast — replace window.confirm()/alert() with
        │                  real modals/toasts
        └── api.js         shared fetch client; auto-clears a dead session token and
                           redirects to /login on 401 instead of failing silently
```

## Setup

**Backend:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in real values — see below
uvicorn app.main:app --reload --port 8000
```

**Frontend (separate terminal, for local dev with hot reload):**
```bash
cd frontend-react
npm install
npm run dev -- --port 5173
```
Open **http://localhost:5173/**. Vite proxies `/api/*` to the backend on port 8000 (see `vite.config.js`).

**Single-process production mode** (one origin, no dev proxy): build the frontend, then have the backend serve it directly.
```bash
cd frontend-react && npm run build   # outputs to dist/
cd ../backend && SERVE_FRONTEND=1 uvicorn app.main:app --port 8000
```
Open **http://localhost:8000/**. The backend's catch-all route serves a real static file when one exists at that path and falls back to `index.html` otherwise, so direct navigation/refresh on any client-side route (e.g. `/recipe/5`) resolves correctly instead of 404ing.

### Environment variables (`backend/.env`, gitignored — copy from `.env.example`)

| Variable | Required? | Purpose |
|---|---|---|
| `DATABASE_URL` | Recommended | Postgres connection string. Omit entirely to fall back to a local SQLite file (`cookify.db`) for zero-config local dev. |
| `SECRET_KEY` | **Yes, for stable sessions** | Signs login JWTs. Without it, a random one is generated *per process start* — safe, but every restart logs everyone out. Generate one with `python3 -c "import secrets; print(secrets.token_hex(32))"`. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | Optional | Real outbound email — login/signup/password-reset OTP codes, comment/rating/subscription/new-recipe notifications, ban warnings. Omit entirely and emails print to the console instead, so the app runs with zero external setup. |
| `SERVE_FRONTEND` | Optional | Set to `1` for the single-process production mode described above. |

Runs on **Python 3.9+**.

## Design notes / honest tradeoffs

- **Recipe photos and videos live in Postgres itself** (`media_data` blob columns), not local disk — local disk doesn't survive a redeploy/restart on most hosts and isn't shared across multiple backend instances, whereas the DB already is. The tradeoff: any query that loads a full `Recipe`/`User` row must explicitly `defer()` that column, or it pulls the full blob (which can be tens of MB for video) even when the response never uses the bytes — done everywhere except the two endpoints whose entire job is serving those bytes (`GET /api/recipes/{id}/media`, `GET /api/users/{id}/avatar`).
- **Login 2FA is an emailed 6-digit code, matching the wireframe.** Generated fresh on each login attempt (after the password checks out), stored briefly on the user row with a 10-minute expiry, and cleared the moment it's verified. An earlier iteration used an authenticator app (TOTP) instead — real security upside, since a compromised inbox otherwise defeats both password-reset and 2FA at once — but the assignment's own wireframe explicitly specifies an emailed code, so this submission follows the spec as written.
- **Sign Up also verifies an emailed 6-digit code before the account is created**, matching the "username already in use" wireframe (which shows a 2FA OTP field the plain Sign Up mockup and the pseudocode both omit). The account isn't written to `users` until the code checks out — a validated-but-unconfirmed signup is staged in `PendingSignup` (keyed by email, 10-minute expiry) so an abandoned signup never leaves a half-created account behind.
- **Forgot Password matches the wireframe's one-page layout** (identifier + new password, one "Confirm New Password" button) but doesn't apply the password on that submission alone — the wireframe's version would let anyone take over any account just by knowing a username. Instead the new password is staged (`pending_password_hash`) behind the same emailed 6-digit code Login and Signup use, applied only once `/verify-reset-otp` confirms it.
- **Chat is REST + polling, not WebSockets.** Simpler to reason about and test for a first version; WebSockets would give real-time push instead of a 4-second poll. Unread state (nav badge + inbox highlight) is tracked server-side per message, not just inferred client-side.
- **Content filtering is a small keyword list**, not a production moderation model — explicitly a baseline, documented in `content_filter.py`.
- **Multi-language uses Google's Translate widget** rather than hand-translated strings, per the assignment's own test case wording ("compatible with Google's translation feature"). Known limitation: switching languages triggers Google's own banner/page-shift behavior, which has proven resistant to suppression from our side — a real, currently-accepted rough edge rather than something silently swept under the rug.
- **There is no bio field**, even though test case 1 lists one alongside the profile picture. It isn't in the DB schema, ER diagram, or any wireframe — the test table appears to be the only place it's mentioned — so it was left out rather than added for that one line alone.
- **Ban system** wipes a user's comments/ratings/recipes on their 3rd warning and blocks login, per the assignment's test case 11.
- **The "Following" filter on Browse** surfaces recipes only from creators you subscribe to, covering the subscription test case's "the subscriber account is recommended more of their posts."
- **The Subscription flowchart/pseudocode opens with a `validateCommentSafe()` gate**, but subscribing takes no comment input — appears carried over from the Commenting flow. Implementing it would mean validating a field that doesn't exist, so subscription goes straight to the subscriber-count/notify steps. The SFW filter it refers to *is* implemented, on commenting, where there's actually text to check.
- **`User.shareRecipe()` from the UML is client-side.** Sharing opens a modal with a copyable link and one-tap WhatsApp/X/Facebook/Email share buttons; it needs no server round-trip. Every other UML method (`register`, `login`, `uploadRecipe`, `rateRecipe`, `Recipe.searchRecipe`, `Recipe.showRecipe`) is a real method on the model, called by the routers.
- **Code formatting:** Black + isort (backend), Prettier (frontend) — run before each commit rather than left ad hoc.

## Test coverage (matches the assignment's test table)

| Case | How to verify |
|---|---|
| Account creation | Sign up (username, email, phone, password), confirm the emailed 6-digit code, then add a profile picture from Edit Profile |
| Login + 2FA | Log in with username, email, *or* phone number and password, then the 6-digit code emailed to your inbox |
| Recipe upload/search/filter | Upload a recipe with a photo or video, then search/filter by ingredient, utensil, cost, time, calories, speed, difficulty, dietary tag, food type, cuisine, and rating |
| Veg/Non-veg + dietary dropdown | Browse page — "Veg only" toggle, plus the Vegetarian/Eggetarian/Pescetarian/Jain/Non-Vegetarian dropdown |
| Popularity sort | Sort by Popularity (view count, tie-broken by newest) |
| Commenting + NSFW filter | Post a comment containing a blocked word — it's rejected and the owner is warned |
| Rating | Click the star row on a recipe — the recipe owner gets notified by email, average updates immediately |
| Edit / Delete / Share / Save recipe | On a recipe you own: "Edit recipe" and "Delete recipe." On any recipe: "Share Recipe" (modal with link + social buttons) and "Save Recipe" (toggles, shows up on your Profile's Saved tab) |
| Ban after 3 warnings | Post 3 blocked comments with the same account — it's banned, its content is wiped, and login is refused |
| Subscription + email + Following feed | Subscribe to a creator (they're notified, toggle works both ways); check Browse → "Following only" to see just their recipes; have them upload a new one to get notified yourself |
| Forgot password | Enter your identifier + new password, then the 6-digit code emailed to confirm it |
| Multilingual | Use the language selector in the nav (Hindi, Mandarin, Russian, Spanish, French configured) |
