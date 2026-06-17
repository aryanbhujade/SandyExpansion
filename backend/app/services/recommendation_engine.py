from __future__ import annotations

import re
from typing import Any


def parse_level(level: str | None) -> int | None:
    if not level:
        return None
    match = re.search(r"(\d+)", str(level))
    return int(match.group(1)) if match else None


def _preferred_level_range(user_level: int | None) -> tuple[int, int]:
    if user_level is None:
        return (3, 10)
    if user_level <= 2:
        return (3, 6)
    if user_level <= 5:
        return (5, 8)
    if user_level <= 8:
        return (8, 11)
    if user_level <= 12:
        return (10, 14)
    return (13, 18)


def _feedback_map(context: dict) -> dict[str, dict[str, Any]]:
    return {
        signal["employee_id"]: signal
        for signal in context.get("previous_feedback_signals", [])
        if signal.get("employee_id")
    }


def _is_very_senior(candidate: dict) -> bool:
    level_num = parse_level(candidate.get("level"))
    role = str(candidate.get("role") or "").lower()
    return (level_num is not None and level_num >= 15) or "cto" in role or "chief" in role


def _score_candidate(candidate: dict, context: dict, feedback: dict[str, dict[str, Any]]) -> dict[str, Any]:
    user_profile = context.get("user_profile") or {}
    user_level = parse_level(user_profile.get("user_level"))
    candidate_level = parse_level(candidate.get("level"))
    preferred_min, preferred_max = _preferred_level_range(user_level)
    score = 0
    reasons: list[str] = []

    matched_skills = candidate.get("matched_skills") or []
    if matched_skills:
        score += min(30, 18 + (len(matched_skills) - 1) * 6)
        reasons.append(f"skill match: {', '.join(matched_skills[:3])}")

    responsibility_matches = candidate.get("responsibility_matches") or []
    if responsibility_matches:
        primary_matches = [item for item in responsibility_matches if item.get("type") == "primary"]
        backup_matches = [item for item in responsibility_matches if item.get("type") == "backup"]
        if primary_matches:
            score += 32
            reasons.append(f"primary contact for {primary_matches[0].get('topic')}")
        if backup_matches:
            score += 18
            reasons.append(f"backup/escalation contact for {backup_matches[0].get('topic')}")

    matched_topics = candidate.get("matched_topics") or []
    if matched_topics:
        score += min(16, 4 * len(matched_topics))
        if not matched_skills:
            reasons.append(f"topic match: {', '.join(matched_topics[:3])}")

    if "same_department" in candidate.get("signals", []):
        score += 8
        reasons.append("same department relevance")

    if candidate_level is not None:
        if preferred_min <= candidate_level <= preferred_max:
            score += 15
            reasons.append("appropriate level for a first contact")
        elif user_level is not None and candidate_level < user_level:
            score -= 5
            reasons.append("below the requester's level")
        elif candidate_level > preferred_max:
            score += 4 if candidate_level <= preferred_max + 2 else 0
            reasons.append("more senior than a normal first contact")

    if _is_very_senior(candidate) and (user_level is None or user_level < 13):
        score -= 30
        reasons.append("very senior escalation contact")

    employee_feedback = feedback.get(candidate["employee_id"])
    if employee_feedback:
        adjustment = int(employee_feedback.get("score_adjustment") or 0)
        score += adjustment
        if adjustment > 2:
            reasons.append("positive prior feedback for this topic")
        elif adjustment < -2:
            reasons.append("negative prior feedback for this topic")
        else:
            reasons.append("mixed prior feedback for this topic")

    score = max(0, min(100, int(round(score))))
    if not reasons:
        reasons.append("matched available employee context")

    return {
        "employee_id": candidate["employee_id"],
        "name": candidate["name"],
        "level": candidate.get("level"),
        "role": candidate.get("role"),
        "department": candidate.get("department"),
        "business_unit": candidate.get("business_unit"),
        "score": score,
        "reason": "; ".join(reasons) + ".",
        "_candidate_level": candidate_level,
        "_is_backup": any(item.get("type") == "backup" for item in responsibility_matches),
        "_is_very_senior": _is_very_senior(candidate),
        "_preferred_max": preferred_max,
    }


def _strip_internal_fields(contact: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in contact.items() if not key.startswith("_")}


def _manager_recommendation(context: dict) -> dict[str, list[dict[str, Any]]]:
    manager = context.get("manager_contact")
    if not manager:
        return {"recommended_contacts": [], "escalation_contacts": []}

    contact = {
        "employee_id": manager["employee_id"],
        "name": manager["name"],
        "level": manager.get("level"),
        "role": manager.get("role"),
        "department": manager.get("department"),
        "business_unit": manager.get("business_unit"),
        "score": 100,
        "reason": "direct manager from the employee hierarchy.",
    }
    return {"recommended_contacts": [contact], "escalation_contacts": []}


def recommend_contacts(context: dict) -> dict:
    analysis = context.get("analysis") or {}
    if analysis.get("primary_intent") == "manager_lookup":
        return _manager_recommendation(context)

    feedback = _feedback_map(context)
    user_level = parse_level((context.get("user_profile") or {}).get("user_level"))
    scored = [
        _score_candidate(candidate, context, feedback)
        for candidate in context.get("candidate_contacts", [])
    ]
    scored = sorted(scored, key=lambda item: item["score"], reverse=True)

    recommended: list[dict[str, Any]] = []
    escalations: list[dict[str, Any]] = []

    for contact in scored:
        candidate_level = contact.get("_candidate_level")
        too_senior_for_first_contact = (
            user_level is not None
            and candidate_level is not None
            and candidate_level > contact["_preferred_max"] + 1
        )
        should_escalate = (
            contact["_is_very_senior"]
            or contact["_is_backup"]
            or too_senior_for_first_contact
        )

        if should_escalate:
            escalations.append(_strip_internal_fields(contact))
        else:
            recommended.append(_strip_internal_fields(contact))

    if not recommended and escalations:
        promoted = escalations.pop(0)
        promoted["reason"] = promoted["reason"] + " No closer first-contact match was found, so this is the best available route."
        recommended.append(promoted)

    return {
        "recommended_contacts": recommended[:3],
        "escalation_contacts": escalations[:2],
    }
