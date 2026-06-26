"""
seed_450.py — Add the 450-employee synthetic dataset (E016..E465) on top of the
curated 15-set, into the currently configured database (Postgres or SQLite),
then run integrity checks.

This is the manual/CLI entry point. The same seeding logic runs automatically
on backend startup via app.main.on_startup -> seed_data.seed_extra_employees,
so running this script is only needed to (re)seed outside the app or to get
the integrity report.

Design choice: ADD, not REPLACE.
  - The curated 15-set (E001..E015) owns the admin (dev.malhotra@example.com)
    and the 9 responsibility_topics (whose primary/backup contacts are
    E001..E013). Replacing them would break topic->contact FKs and lose the
    admin. The 450-set continues the uniform E### namespace at E016..E465 and
    now shares the @example.com email domain. No id or email collisions.
  - Responsibility topics are NOT regenerated here; the 9 curated topics stay.

Idempotent: safe to re-run (upserts; existing passwords are never reset).
Reads data/seed_employees_450.json.

Usage (from backend/):
    .venv/bin/python seed_450.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Allow running as a script from the backend directory.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import func, select

from app.database import Employee, EmployeeProfile, UserCredential, SessionLocal, init_db
from app.services.seed_data import seed_database, seed_extra_employees

ADMIN_EMAIL = os.getenv("SANDY_ADMIN_EMAIL", "dev.malhotra@example.com").strip().lower()


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        # Make sure the curated 15-set (+ topics, admin, demo creds) exists first.
        if db.query(Employee).count() == 0:
            print("DB empty — seeding curated 15-set + topics first...")
            seed_database(db)

        counts = seed_extra_employees(db)
        print(f"Upserted {counts['extra_employees']} synthetic employees "
              f"({counts['extra_credentials_created']} new credentials).")

        # Integrity checks on the full DB.
        n_emp = db.query(Employee).count()
        n_prof = db.query(EmployeeProfile).count()
        n_cred = db.query(UserCredential).count()
        dup_emails = db.execute(
            select(UserCredential.email).group_by(UserCredential.email)
            .having(func.count(UserCredential.employee_id) > 1)
        ).scalars().all()

        all_ids = {eid for (eid,) in db.query(Employee.id).all()}
        bad_managers = db.execute(
            select(Employee.id, Employee.manager_id).where(Employee.manager_id.isnot(None))
        ).all()
        orphan_mgrs = [(eid, mid) for eid, mid in bad_managers if mid not in all_ids]

        non_example = db.query(UserCredential).filter(
            ~UserCredential.email.like("%@example.com")
        ).count()

        print("\n--- Seeding complete ---")
        print(f"employees total:      {n_emp}  (15 curated + {counts['extra_employees']} added)")
        print(f"employee_profiles:    {n_prof}")
        print(f"credentials:          {n_cred}")
        print(f"duplicate emails:     {len(dup_emails)}  {dup_emails[:5]}")
        print(f"orphan manager refs:  {len(orphan_mgrs)}  {orphan_mgrs[:5]}")
        print(f"non-@example.com creds: {non_example}")
        print(f"admin email:          {ADMIN_EMAIL}")
        admin = db.query(UserCredential).filter(UserCredential.email == ADMIN_EMAIL).first()
        print(f"admin present+flag:   {bool(admin) and admin.is_admin}")
        if dup_emails or orphan_mgrs or non_example:
            print("\nINTEGRITY CHECK FAILED")
            sys.exit(1)
        print("\nIntegrity check: OK")
    finally:
        db.close()


if __name__ == "__main__":
    main()