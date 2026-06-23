from __future__ import annotations

import argparse
import json

import bcrypt

from app.database import Base, Employee, SessionLocal, UserCredential, engine, init_db
from app.services.seed_data import seed_database

DEFAULT_PASSWORD = "Password123!"


def _seed_credentials(db) -> int:
    hashed_password = bcrypt.hashpw(DEFAULT_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    count = 0

    for employee in db.query(Employee).all():
        db.add(
            UserCredential(
                employee_id=employee.id,
                email=employee.email.strip().lower(),
                hashed_password=hashed_password,
            )
        )
        count += 1

    db.commit()
    return count


def reset_database() -> dict[str, int]:
    Base.metadata.drop_all(bind=engine)
    init_db()

    db = SessionLocal()
    try:
        counts = seed_database(db)
        counts["credentials"] = _seed_credentials(db)
        return counts
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Reset the local Sandy Connect database to the seeded demo state. "
            "This clears chats, recommendations, contact requests, feedback, messages, and notifications."
        )
    )
    parser.add_argument("--yes", action="store_true", help="Confirm that the database should be reset.")
    args = parser.parse_args()

    if not args.yes:
        raise SystemExit("Refusing to reset without --yes.")

    counts = reset_database()
    print(json.dumps({"status": "ok", "reset": counts, "default_password": DEFAULT_PASSWORD}, indent=2))


if __name__ == "__main__":
    main()
