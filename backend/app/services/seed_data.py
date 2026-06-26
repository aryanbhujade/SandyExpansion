from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import bcrypt

from app.database import (
    Employee,
    EmployeeProfile,
    ResponsibilityTopic,
    SessionLocal,
    UserCredential,
    init_db,
    utcnow,
)

BACKEND_ROOT = Path(__file__).resolve().parents[2]
SEED_FILE = BACKEND_ROOT / "data" / "seed_employees.json"
# The 450-employee synthetic dataset (ids E016..E465) layered on top of the
# curated 15-set. Auto-seeded on backend startup when absent (see main.py).
EXTRA_SEED_FILE = BACKEND_ROOT / "data" / "seed_employees_450.json"

DEFAULT_PASSWORD = "Password123!"
ADMIN_EMAIL_ENV = "SANDY_ADMIN_EMAIL"
DEFAULT_ADMIN_EMAIL = "dev.malhotra@example.com"


def _admin_email() -> str:
    return os.getenv(ADMIN_EMAIL_ENV, DEFAULT_ADMIN_EMAIL).strip().lower()


def get_password_hash(password: str) -> str:
    """bcrypt-hash a plaintext password for credential storage."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


RESPONSIBILITY_TOPICS: list[dict[str, Any]] = [
    {
        "topic": "AWS",
        "keywords": ["aws", "amazon web services", "cloud", "terraform", "cloudformation"],
        "primary_contact_id": "E003",
        "backup_contact_id": "E006",
        "knowledge_summary": "AWS delivery questions should start with the cloud platform team before escalating to architecture.",
        "source": "mock_seed",
    },
    {
        "topic": "Azure DevOps / ADO access",
        "keywords": ["azure devops", "ado", "ado access", "pipelines", "repo access", "release"],
        "primary_contact_id": "E004",
        "backup_contact_id": "E006",
        "knowledge_summary": "Azure DevOps and ADO access requests are handled through DevOps first, with delivery escalation if blocked.",
        "source": "mock_seed",
    },
    {
        "topic": "Zoho access",
        "keywords": ["zoho", "crm", "zoho access", "corporate systems"],
        "primary_contact_id": "E005",
        "backup_contact_id": "E009",
        "knowledge_summary": "Zoho access and CRM workflow support should start with corporate business systems.",
        "source": "mock_seed",
    },
    {
        "topic": "Sandy Bot",
        "keywords": ["sandy", "sandy bot", "teams bot", "internal assistant"],
        "primary_contact_id": "E001",
        "backup_contact_id": "E012",
        "knowledge_summary": "Sandy Bot product questions should start with the AI products team, then escalate to architecture.",
        "source": "mock_seed",
    },
    {
        "topic": "PageIndex",
        "keywords": ["pageindex", "page index", "knowledge retrieval", "retrieval"],
        "primary_contact_id": "E001",
        "backup_contact_id": "E012",
        "knowledge_summary": "PageIndex is treated as a knowledge retrieval platform area owned by AI products and architecture.",
        "source": "mock_seed",
    },
    {
        "topic": "upcoming expos / event coordination",
        "keywords": ["expo", "expos", "event", "events", "conference", "roadshow", "event coordination"],
        "primary_contact_id": "E007",
        "backup_contact_id": "E011",
        "knowledge_summary": "Upcoming expos and event logistics are coordinated by marketing, with the marketing lead as escalation.",
        "source": "mock_seed",
    },
    {
        "topic": "legacy modernisation",
        "keywords": ["legacy", "modernisation", "modernization", "mainframe", "transformation"],
        "primary_contact_id": "E008",
        "backup_contact_id": "E010",
        "knowledge_summary": "Legacy modernisation requests often need sales discovery first, then senior architecture support.",
        "source": "mock_seed",
    },
    {
        "topic": "AI products",
        "keywords": ["ai products", "ai product", "azure openai", "assistant", "llm"],
        "primary_contact_id": "E001",
        "backup_contact_id": "E012",
        "knowledge_summary": "AI product questions start with the product implementation owner before architecture escalation.",
        "source": "mock_seed",
    },
    {
        "topic": "banking client support",
        "keywords": ["banking", "financial services", "client support", "payments", "bank"],
        "primary_contact_id": "E008",
        "backup_contact_id": "E013",
        "knowledge_summary": "Banking client support should start with client solutions, with sales director escalation for account-sensitive topics.",
        "source": "mock_seed",
    },
]


def _load_seed_file() -> list[dict[str, Any]]:
    with SEED_FILE.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError("seed_employees.json must contain a list of employees.")
    return data


def _upsert_employee(db, item: dict[str, Any], include_manager: bool = True) -> Employee:
    employee = db.get(Employee, item["id"])
    if employee is None:
        employee = Employee(id=item["id"])
        db.add(employee)

    employee.name = item["name"]
    employee.email = item["email"]
    employee.level = item.get("level")
    employee.role = item.get("role")
    employee.department = item.get("department")
    employee.business_unit = item.get("business_unit")
    employee.manager_id = item.get("manager_id") if include_manager else None
    employee.location = item.get("location")
    return employee


def _upsert_profile(db, item: dict[str, Any]) -> EmployeeProfile:
    profile = db.query(EmployeeProfile).filter(EmployeeProfile.employee_id == item["id"]).first()
    if profile is None:
        profile = EmployeeProfile(employee_id=item["id"])
        db.add(profile)

    profile.skills_json = json.dumps(item.get("skills", []))
    profile.expertise_topics_json = json.dumps(item.get("expertise_topics", []))
    profile.projects_json = json.dumps(item.get("projects", []))
    profile.notes = item.get("notes")
    profile.confidence_score = float(item.get("confidence_score", 0.8))
    profile.last_updated = utcnow()
    return profile


def _upsert_responsibility_topic(db, item: dict[str, Any]) -> ResponsibilityTopic:
    topic = db.query(ResponsibilityTopic).filter(ResponsibilityTopic.topic == item["topic"]).first()
    if topic is None:
        topic = ResponsibilityTopic(topic=item["topic"])
        db.add(topic)

    topic.keywords_json = json.dumps(item.get("keywords", []))
    topic.primary_contact_id = item.get("primary_contact_id")
    topic.backup_contact_id = item.get("backup_contact_id")
    topic.knowledge_summary = item.get("knowledge_summary")
    topic.source = item.get("source")
    return topic


def seed_database(db) -> dict[str, int]:
    employees = _load_seed_file()
    for item in employees:
        _upsert_employee(db, item, include_manager=False)
    db.flush()

    for item in employees:
        employee = db.get(Employee, item["id"])
        if employee is not None:
            employee.manager_id = item.get("manager_id")
        _upsert_profile(db, item)

    for topic in RESPONSIBILITY_TOPICS:
        _upsert_responsibility_topic(db, topic)

    db.commit()
    return {
        "employees": len(employees),
        "employee_profiles": len(employees),
        "responsibility_topics": len(RESPONSIBILITY_TOPICS),
    }


def seed_extra_employees(db) -> dict[str, int]:
    """Layer the 450-employee synthetic dataset (E016..E465) on top of the
    curated 15-set, including profiles and login credentials.

    Idempotent: safe to re-run. Upserts employees/profiles and only creates
    credentials for employees that don't yet have one (existing passwords are
    never reset). Responsibility topics are NOT touched here (the 9 curated
    topics stay valid against E001..E013).

    No-op (returns zero counts) when the 450 seed file is absent, so a
    checkout without the synthetic dataset still boots the 15-set normally.

    Returns counts of employees upserted and credentials created this run.
    """
    if not EXTRA_SEED_FILE.exists():
        return {"extra_employees": 0, "extra_credentials_created": 0}

    rows = json.loads(EXTRA_SEED_FILE.read_text(encoding="utf-8"))
    admin_email = _admin_email()

    # 1) Upsert employees — two-pass so manager_id self-FKs resolve.
    for item in rows:
        _upsert_employee(db, item, include_manager=False)
    db.flush()
    for item in rows:
        employee = db.get(Employee, item["id"])
        if employee is not None:
            employee.manager_id = item.get("manager_id")
        _upsert_profile(db, item)

    # 2) Upsert credentials (default password). Admin stays with the 15-set's
    #    dev.malhotra; these rows are is_admin=False unless one of them happens
    #    to match the configured admin email, in which case promote it.
    hashed = get_password_hash(DEFAULT_PASSWORD)
    created_credentials = 0
    for item in rows:
        email = item["email"].strip().lower()
        existing = db.query(UserCredential).filter(
            UserCredential.employee_id == item["id"]
        ).first()
        if existing is None:
            db.add(
                UserCredential(
                    employee_id=item["id"],
                    email=email,
                    hashed_password=hashed,
                    is_admin=(email == admin_email),
                )
            )
            created_credentials += 1
        elif email == admin_email and not existing.is_admin:
            existing.is_admin = True

    db.commit()
    return {"extra_employees": len(rows), "extra_credentials_created": created_credentials}


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        counts = seed_database(db)
        print(json.dumps({"status": "ok", "seeded": counts}, indent=2))
    finally:
        db.close()


if __name__ == "__main__":
    main()
