"""Copy everything from the local SQLite file into the database in DATABASE_URL.

    DATABASE_URL='postgresql://...' python3 migrate_to_postgres.py

Creates the schema on the target, copies every table in dependency order, and
resets the id sequences afterwards — Postgres tracks the next id in a sequence
that doesn't advance when rows are inserted with explicit ids, so without that
last step the first signup after migrating would collide with an existing row.

Safe to inspect first: pass --dry-run to see the row counts without writing.
"""
import os
import sys

from dotenv import load_dotenv

load_dotenv()  # same config the app reads, so the two can't disagree

from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

DRY_RUN = "--dry-run" in sys.argv

target_url = os.getenv("DATABASE_URL", "").strip()
if not target_url:
    sys.exit("Set DATABASE_URL to the target database first.")
if target_url.startswith("sqlite"):
    sys.exit("DATABASE_URL points at SQLite — nothing to migrate to.")

# Import models against the *target* engine (app.database reads DATABASE_URL).
from app.database import Base, engine as target_engine, IS_SQLITE  # noqa: E402
from app import models  # noqa: F401,E402 — registers every table on Base
from app.models import (  # noqa: E402
    User, UserPreference, RememberedDevice,
    Recipe, Rating, Comment, Subscription, ChatMessage, Warning, SavedRecipe,
)

assert not IS_SQLITE, "target resolved to SQLite — check DATABASE_URL"

_SQLITE_PATH = os.path.join(os.path.dirname(__file__), "cookify.db")
if not os.path.exists(_SQLITE_PATH):
    sys.exit(f"No SQLite database at {_SQLITE_PATH}")

source_engine = create_engine(f"sqlite:///{_SQLITE_PATH}", connect_args={"check_same_thread": False})
SourceSession = sessionmaker(bind=source_engine)
TargetSession = sessionmaker(bind=target_engine)

# Parents before children — foreign keys are enforced on Postgres.
ORDER = [User, UserPreference, RememberedDevice, Recipe,
         Rating, Comment, Subscription, ChatMessage, Warning, SavedRecipe]


def main():
    src, dst = SourceSession(), TargetSession()

    if not DRY_RUN:
        Base.metadata.create_all(bind=target_engine)
        print("schema created on target")

    for model in ORDER:
        rows = src.query(model).all()
        print(f"  {model.__tablename__:20} {len(rows):4} rows", end="")

        if DRY_RUN:
            print("  (dry run)")
            continue

        if dst.query(model).count():
            print("  — target not empty, skipped")
            continue

        for row in rows:
            # Copy real columns only; relationships rebuild from the FKs.
            data = {c.name: getattr(row, c.name) for c in model.__table__.columns}
            dst.add(model(**data))
        dst.commit()
        print("  copied")

    if not DRY_RUN:
        # Realign each sequence with the highest id actually present.
        for model in ORDER:
            table = model.__tablename__
            dst.execute(text(
                f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM {table}), 1))"
            ))
        dst.commit()
        print("id sequences realigned")

    src.close()
    dst.close()
    print("done")


if __name__ == "__main__":
    main()
