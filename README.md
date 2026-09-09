# Cookify — Recipe-Sharing Platform

A full-stack recipe-sharing web application: user accounts with 2FA, a searchable/filterable recipe database, comments, ratings, subscriptions with email notifications, a ban system, basic chat, and multi-language support.

Built as a technical assignment. Backend in **Python (FastAPI)** rather than Java — language was confirmed flexible; Python was chosen to match my actual production experience. OOP requirements (inheritance/polymorphism for recipe categorization) are implemented via `Recipe` → `VegRecipe` / `NonVegRecipe` (see `backend/app/models/recipe.py`). Frontend is plain HTML/CSS/JS, as specified.

## Architecture

```
Cookify/
├── backend/            FastAPI + SQLAlchemy + SQLite (free, zero-config DB)
│   └── app/
│       ├── models/     User, Recipe (+ Veg/NonVeg subclasses), Rating, Comment, Subscription, ChatMessage, Warning
│       ├── routers/    auth, recipes, social (comments/ratings/subscriptions), chat, users
│       └── services/   password hashing/JWT, content filtering, email (dev-mode console fallback)
└── frontend/            Plain HTML/CSS/JS, one file per page
    ├── pages/           index, login, signup, forgot-password, browse, recipe, upload, profile, chat
    └── js/               api.js (shared API client), navbar.js (shared nav/footer + Google Translate widget)
```

## Setup

Single command, single port — the backend serves the frontend directly (see the static mount at the bottom of `backend/app/main.py`), so there's no separate frontend server or CORS configuration to worry about:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then open **http://localhost:8000/pages/index.html**. The SQLite database (`cookify.db`) is created automatically on first run.

The API client (`frontend/js/api.js`) calls same-origin relative paths, so this also works unchanged behind any real domain/port in production — nothing hardcoded to localhost.

## Design notes / honest tradeoffs

- **Chat is REST + polling, not WebSockets.** Simpler to reason about and test for a first version; WebSockets would give real-time push instead of a 4-second poll.
- **Content filtering is a small keyword list**, not a production moderation model — explicitly a baseline, documented in `content_filter.py`.
- **Email is console-logged by default** (dev mode) unless `SMTP_*` environment variables are set — so the app runs with zero external setup, but real SMTP can be plugged in.
- **Multi-language uses Google's Translate widget** rather than hand-translated strings, per the assignment's own test case wording ("compatible with Google's translation feature").
- **Ban system** wipes a user's comments/ratings/recipes on their 3rd warning, per the assignment's test case 11.

## Test coverage (matches the assignment's test table)

| Case | How to verify |
|---|---|
| Account creation | Sign up on `signup.html` |
| Login + 2FA | Log in on `login.html` — OTP is printed to the backend console in dev mode |
| Recipe upload/search/filter | `upload.html`, then `browse.html` with filters |
| Veg/Non-veg toggle | `browse.html` → "Veg only" checkbox |
| Popularity sort | `browse.html` → Sort by Popularity (driven by view count) |
| Commenting + NSFW filter | `recipe.html` — try a comment containing a blocked word |
| Rating | `recipe.html` → click the star row |
| Ban after 3 warnings | Post 3 blocked comments with the same account |
| Subscription + email | Subscribe on `recipe.html`, then upload a new recipe as that creator — check backend console for the notification |
