"""Database setup.

Driven by DATABASE_URL so the same code runs on SQLite locally (zero setup)
and on a Postgres server in deployment — no code change between the two,
just the environment variable. SQLAlchemy handles the dialect differences.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Absolute path, derived from this file's own location — a relative
# "./cookify.db" resolves against the process's working directory at
# runtime, which isn't guaranteed to be backend/ (same class of bug already
# fixed for the static file mount in main.py).
_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cookify.db")
DATABASE_URL = os.getenv("DATABASE_URL", "").strip() or f"sqlite:///{_DB_PATH}"

# Several hosts still hand out the legacy "postgres://" scheme, which
# SQLAlchemy 2.x no longer recognises.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# A bare "postgresql://" still resolves to psycopg2 in SQLAlchemy; this
# project uses psycopg 3, so point the URL at that driver explicitly.
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

IS_SQLITE = DATABASE_URL.startswith("sqlite")

engine = create_engine(
    DATABASE_URL,
    # check_same_thread is a SQLite-only flag; Postgres rejects it.
    connect_args={"check_same_thread": False} if IS_SQLITE else {},
    # Hosted Postgres drops idle connections (Neon suspends them entirely).
    # Without this the first request after a lull dies on a stale socket.
    pool_pre_ping=not IS_SQLITE,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
