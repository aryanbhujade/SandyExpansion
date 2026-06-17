from __future__ import annotations

import json
import re
from typing import Any

from app.database import Employee, EmployeeProfile, ResponsibilityTopic
from app.services.feedback_service import calculate_feedback_adjustment_scores

STOPWORDS = {
    "a",
    "about",
    "an",
    "and",
    "are",
    "best",
    "can",
    "contact",
    "do",
    "for",
    "handle",
    "handled",
    "handles",
    "help",
    "i",
    "me",
    "my",
    "of",
    "on",
    "or",
    "should",
    "speak",
    "the",
    "to",
    "who",
    "with",
    "works",
}


def _json_list(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(item) for item in parsed if str(item).strip()]


def _normalise(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def _tokens(value: str | None) -> set[str]:
    words = re.findall(r"[a-z0-9]+", _normalise(value))
    return {word for word in words if word not in STOPWORDS and len(word) > 1}


def _employee_dict(employee: Employee | None, profile: EmployeeProfile | None = None) -> dict[str, Any] | None:
    if employee is None:
        return None
    data: dict[str, Any] = {
        "employee_id": employee.id,
        "name": employee.name,
        "email": employee.email,
        "level": employee.level,
        "role": employee.role,
        "department": employee.department,
        "business_unit": employee.business_unit,
        "manager_id": employee.manager_id,
        "location": employee.location,
    }
    if profile is not None:
        data.update(
            {
                "skills": _json_list(profile.skills_json),
                "expertise_topics": _json_list(profile.expertise_topics_json),
                "projects": _json_list(profile.projects_json),
                "notes": profile.notes,
                "confidence_score": profile.confidence_score,
            }
        )
    return data


def _find_employee_for_user(db, user_profile: dict | None) -> Employee | None:
    if not user_profile:
        return None

    user_id = user_profile.get("user_id")
    if user_id:
        employee = db.get(Employee, str(user_id))
        if employee is not None:
            return employee

    user_name = _normalise(user_profile.get("user_name"))
    if not user_name:
        return None

    exact = db.query(Employee).filter(Employee.name.ilike(user_name)).first()
    if exact is not None:
        return exact

    prefix = db.query(Employee).filter(Employee.name.ilike(f"{user_name}%")).first()
    if prefix is not None:
        return prefix

    first_name = user_name.split(" ")[0]
    if first_name:
        return db.query(Employee).filter(Employee.name.ilike(f"{first_name}%")).first()

    return None


def _match_responsibility_topics(db, analysis: dict, user_message: str) -> list[dict[str, Any]]:
    query_text = " ".join(
        [
            str(analysis.get("topic") or ""),
            user_message,
            " ".join(analysis.get("required_skills") or []),
        ]
    )
    query_norm = _normalise(query_text)
    query_tokens = _tokens(query_text)

    matches: list[dict[str, Any]] = []
    for topic in db.query(ResponsibilityTopic).all():
        topic_tokens = _tokens(topic.topic)
        keywords = _json_list(topic.keywords_json)
        score = 0
        direct_score = 0

        topic_norm = _normalise(topic.topic)
        if topic_norm and (topic_norm in query_norm or query_norm in topic_norm):
            direct_score += 6

        for keyword in keywords:
            keyword_norm = _normalise(keyword)
            if keyword_norm and keyword_norm in query_norm:
                direct_score += 5

        token_overlap = len(query_tokens & topic_tokens)
        score = direct_score + token_overlap * 2
        if direct_score == 0 and token_overlap < 2:
            continue
        if score <= 0:
            continue

        primary = _employee_dict(db.get(Employee, topic.primary_contact_id)) if topic.primary_contact_id else None
        backup = _employee_dict(db.get(Employee, topic.backup_contact_id)) if topic.backup_contact_id else None
        matches.append(
            {
                "id": topic.id,
                "topic": topic.topic,
                "keywords": keywords,
                "knowledge_summary": topic.knowledge_summary,
                "source": topic.source,
                "primary_contact": primary,
                "backup_contact": backup,
                "match_score": score,
            }
        )

    return sorted(matches, key=lambda item: item["match_score"], reverse=True)


def _add_candidate(candidates: dict[str, dict[str, Any]], employee: Employee, profile: EmployeeProfile | None) -> dict[str, Any]:
    candidate = candidates.get(employee.id)
    if candidate is None:
        candidate = _employee_dict(employee, profile) or {}
        candidate.update(
            {
                "matched_skills": [],
                "matched_topics": [],
                "responsibility_matches": [],
                "knowledge_sources": [],
                "signals": [],
            }
        )
        candidates[employee.id] = candidate
    elif profile is not None and "skills" not in candidate:
        candidate.update(_employee_dict(employee, profile) or {})
    return candidate


def _candidate_from_responsibility_matches(
    db,
    matches: list[dict[str, Any]],
    user_employee_id: str | None,
) -> dict[str, dict[str, Any]]:
    candidates: dict[str, dict[str, Any]] = {}
    for match in matches:
        for contact_type in ["primary_contact", "backup_contact"]:
            contact = match.get(contact_type)
            if not contact:
                continue
            employee_id = contact["employee_id"]
            if employee_id == user_employee_id:
                continue
            employee = db.get(Employee, employee_id)
            profile = db.query(EmployeeProfile).filter(EmployeeProfile.employee_id == employee_id).first()
            if employee is None:
                continue
            candidate = _add_candidate(candidates, employee, profile)
            responsibility_type = "primary" if contact_type == "primary_contact" else "backup"
            candidate["responsibility_matches"].append(
                {
                    "topic": match["topic"],
                    "type": responsibility_type,
                    "match_score": match["match_score"],
                }
            )
            candidate["knowledge_sources"].append(match["source"])
            candidate["signals"].append(f"responsibility_{responsibility_type}:{match['topic']}")
    return candidates


def _match_employee_profiles(
    db,
    candidates: dict[str, dict[str, Any]],
    analysis: dict,
    user_message: str,
    user_profile: dict | None,
    user_employee_id: str | None,
) -> None:
    required_skills = [str(skill) for skill in analysis.get("required_skills") or []]
    required_norms = {_normalise(skill) for skill in required_skills}
    topic = analysis.get("topic") or ""
    query_tokens = _tokens(" ".join([topic, user_message, " ".join(required_skills)]))
    user_department = _normalise((user_profile or {}).get("user_department"))

    for profile in db.query(EmployeeProfile).all():
        employee = db.get(Employee, profile.employee_id)
        if employee is None or employee.id == user_employee_id:
            continue

        skills = _json_list(profile.skills_json)
        expertise_topics = _json_list(profile.expertise_topics_json)
        projects = _json_list(profile.projects_json)
        searchable_text = " ".join(skills + expertise_topics + projects + [profile.notes or ""])
        searchable_norm = _normalise(searchable_text)
        searchable_tokens = _tokens(searchable_text)

        matched_skills = []
        for skill in skills:
            skill_norm = _normalise(skill)
            if skill_norm in required_norms or any(req and req in skill_norm for req in required_norms):
                matched_skills.append(skill)

        matched_topic_tokens = sorted(query_tokens & searchable_tokens)
        direct_topic_match = _normalise(topic) and _normalise(topic) in searchable_norm

        if not matched_skills and not direct_topic_match and len(matched_topic_tokens) < 2:
            continue

        candidate = _add_candidate(candidates, employee, profile)
        for skill in matched_skills:
            if skill not in candidate["matched_skills"]:
                candidate["matched_skills"].append(skill)
                candidate["signals"].append(f"skill:{skill}")

        if direct_topic_match:
            if topic not in candidate["matched_topics"]:
                candidate["matched_topics"].append(topic)
            candidate["signals"].append(f"topic:{topic}")

        for token in matched_topic_tokens:
            if token not in candidate["matched_topics"]:
                candidate["matched_topics"].append(token)

        if user_department and _normalise(employee.department) == user_department:
            candidate["signals"].append("same_department")


def build_context(db, analysis: dict, user_message: str, user_profile: dict | None = None) -> dict:
    user_employee = _find_employee_for_user(db, user_profile)
    user_employee_id = user_employee.id if user_employee else None
    effective_user_profile = dict(user_profile or {})
    if user_employee is not None:
        effective_user_profile.setdefault("user_id", user_employee.id)
        if not effective_user_profile.get("user_level"):
            effective_user_profile["user_level"] = user_employee.level
        if not effective_user_profile.get("user_role"):
            effective_user_profile["user_role"] = user_employee.role
        if not effective_user_profile.get("user_department"):
            effective_user_profile["user_department"] = user_employee.department

    manager_contact = None
    if analysis.get("primary_intent") == "manager_lookup" or analysis.get("needs_user_profile"):
        if user_employee and user_employee.manager_id:
            manager = db.get(Employee, user_employee.manager_id)
            manager_profile = (
                db.query(EmployeeProfile).filter(EmployeeProfile.employee_id == manager.id).first()
                if manager
                else None
            )
            manager_contact = _employee_dict(manager, manager_profile)

    responsibility_matches = _match_responsibility_topics(db, analysis, user_message)
    candidates = _candidate_from_responsibility_matches(db, responsibility_matches, user_employee_id)
    _match_employee_profiles(db, candidates, analysis, user_message, effective_user_profile, user_employee_id)

    candidate_contacts = sorted(
        candidates.values(),
        key=lambda candidate: (
            len(candidate.get("responsibility_matches", [])),
            len(candidate.get("matched_skills", [])),
            len(candidate.get("matched_topics", [])),
        ),
        reverse=True,
    )

    feedback_signals = calculate_feedback_adjustment_scores(
        db,
        [candidate["employee_id"] for candidate in candidate_contacts],
        topic=analysis.get("topic"),
    )

    missing_information: list[str] = []
    if analysis.get("needs_user_profile") and not user_employee:
        missing_information.append("Could not match the requesting user to an employee record.")
    if analysis.get("needs_user_profile") and not effective_user_profile.get("user_level"):
        missing_information.append("Requester level was not provided.")
    if analysis.get("needs_contact") and not candidate_contacts and manager_contact is None:
        missing_information.append("No suitable candidate contacts matched the request.")
    if analysis.get("needs_knowledge") and not responsibility_matches:
        missing_information.append("No approved knowledge summary matched the request.")
    if not analysis.get("topic") and analysis.get("primary_intent") != "manager_lookup":
        missing_information.append("The request topic was unclear.")

    return {
        "analysis": analysis,
        "user_profile": effective_user_profile,
        "matched_user": _employee_dict(user_employee) if user_employee else None,
        "knowledge_matches": responsibility_matches,
        "candidate_contacts": candidate_contacts,
        "manager_contact": manager_contact,
        "previous_feedback_signals": list(feedback_signals.values()),
        "missing_information": missing_information,
    }
