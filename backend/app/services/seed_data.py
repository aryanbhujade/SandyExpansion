from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.database import Employee, EmployeeProfile, ResponsibilityTopic, SessionLocal, init_db, utcnow

BACKEND_ROOT = Path(__file__).resolve().parents[2]
SEED_FILE = BACKEND_ROOT / "data" / "seed_employees.json"


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


def _upsert_employee(db, item: dict[str, Any]) -> Employee:
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
    employee.manager_id = item.get("manager_id")
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
        _upsert_employee(db, item)
        _upsert_profile(db, item)

    for topic in RESPONSIBILITY_TOPICS:
        _upsert_responsibility_topic(db, topic)

    db.commit()
    return {
        "employees": len(employees),
        "employee_profiles": len(employees),
        "responsibility_topics": len(RESPONSIBILITY_TOPICS),
    }


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
