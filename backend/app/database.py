"""SQLite database setup — free, zero-config, file-based (per assignment: use a free DB)."""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Absolute path, derived from this file's own location — a relative
# "./cookify.db" resolves against the process's working directory at
# runtime, which isn't guaranteed to be backend/ (same class of bug already
# fixed for the static file mount in main.py).
_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cookify.db")
DATABASE_URL = f"sqlite:///{_DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
