"""Cookify — recipe-sharing platform.

Entry point: creates the FastAPI app, wires up all routers, mounts uploaded
media as static files, and creates the SQLite tables on startup.
"""
import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

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


# Serve the React production build from this same app/port. Also sidesteps
# needing two separate origins for local dev — one process, one port,
# frontend and API both same-origin.
#
# The React app uses BrowserRouter (clean URLs, no "#"), so a direct
# navigation/refresh on a client-side route like /recipe/5 or /profile/3
# reaches the server as a literal path it has no file for. The catch-all
# below handles that: serve a real file under dist/ if one exists at that
# path (JS/CSS/assets/favicon), otherwise fall back to index.html so React
# Router can take over and resolve the route client-side. Registered last so
# it never shadows the /api/* routes above.
_FRONTEND_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend-react", "dist"))

if os.path.isdir(_FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(_FRONTEND_DIR, "assets")), name="frontend-assets")

    _INDEX_HTML = os.path.join(_FRONTEND_DIR, "index.html")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str, request: Request):
        candidate = os.path.normpath(os.path.join(_FRONTEND_DIR, full_path))
        if candidate.startswith(_FRONTEND_DIR) and os.path.isfile(candidate) and candidate != _INDEX_HTML:
            return FileResponse(candidate)
        # index.html names the content-hashed JS/CSS bundles, so it has to be
        # revalidated on every load. Cached, it keeps pointing a browser at a
        # previous build's assets and new deploys silently never arrive.
        return FileResponse(_INDEX_HTML, headers={"Cache-Control": "no-cache, must-revalidate"})
