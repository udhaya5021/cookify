"""Cookify — recipe-sharing platform.

Entry point: creates the FastAPI app, wires up all routers, mounts uploaded
media as static files, and creates the SQLite tables on startup.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app import models  # noqa: F401 — import registers all models with Base
from app.routers import auth, recipes, social, chat, users

app = FastAPI(title="Cookify API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(recipes.router)
app.include_router(social.router)
app.include_router(chat.router)
app.include_router(users.router)

# Absolute path, derived from this file's own location — not a relative
# "app/static" string, which broke depending on the process's working
# directory (it worked when launched from backend/, failed otherwise).
_STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(os.path.join(_STATIC_DIR, "uploads"), exist_ok=True)
app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve the React production build from this same app/port. Kept last so it
# never shadows the API routes above (FastAPI matches path operations before
# a "/" mount). Also sidesteps needing two separate origins for local dev —
# one process, one port, frontend and API both same-origin.
#
# The React app uses HashRouter (not BrowserRouter) specifically so this
# plain static mount works correctly — with real client-side routes
# (BrowserRouter), navigating straight to e.g. /recipe/5 would 404 here,
# since StaticFiles just serves files and has no SPA-fallback-to-index.html
# logic. HashRouter keeps all routing state after a "#", so every route
# resolves to this same index.html regardless.
_FRONTEND_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend-react", "dist"))
if os.path.isdir(_FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=_FRONTEND_DIR, html=True), name="frontend")
