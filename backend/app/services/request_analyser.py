from __future__ import annotations

import json
import re
from typing import Any

from app.services.local_llm import LocalLLMError, generate_text

ALLOWED_INTENTS = {
    "find_contact",
    "ask_question",
    "manager_lookup",
    "access_help",
    "fallback",
}


def _base_analysis() -> dict[str, Any]:
    return {
        "primary_intent": "fallback",
        "topic": None,
        "required_skills": [],
        "needs_knowledge": False,
        "needs_contact": False,
        "needs_user_profile": False,
        "requires_human": True,
        "confidence": 0.2,
    }


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "yes", "1", "y"}
    return bool(value)


def _clamp_confidence(value: Any) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return 0.2
    return max(0.0, min(1.0, confidence))


def _extract_json(raw_text: str) -> dict[str, Any] | None:
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
    if not match:
        return None
    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _normalise_analysis(raw: dict[str, Any]) -> dict[str, Any]:
    result = _base_analysis()

    intent = str(raw.get("primary_intent", "fallback")).strip().lower()
    result["primary_intent"] = intent if intent in ALLOWED_INTENTS else "fallback"

    topic = raw.get("topic")
    result["topic"] = str(topic).strip() if topic not in {None, ""} else None

    skills = raw.get("required_skills", [])
    if isinstance(skills, str):
        skills = [skills]
    if not isinstance(skills, list):
        skills = []
    result["required_skills"] = [str(skill).strip() for skill in skills if str(skill).strip()]

    for key in ["needs_knowledge", "needs_contact", "needs_user_profile", "requires_human"]:
        result[key] = _coerce_bool(raw.get(key, result[key]))

    result["confidence"] = _clamp_confidence(raw.get("confidence", result["confidence"]))

    if result["primary_intent"] == "manager_lookup":
        result["needs_user_profile"] = True
        result["needs_contact"] = True

    if result["primary_intent"] in {"find_contact", "access_help"}:
        result["needs_contact"] = True

    return result


def _heuristic_analysis(user_message: str) -> dict[str, Any]:
    text = user_message.lower()
    analysis = _base_analysis()

    if any(phrase in text for phrase in ["who do i report to", "my manager", "line manager", "reporting manager"]):
        analysis.update(
            {
                "primary_intent": "manager_lookup",
                "topic": "manager",
                "needs_contact": True,
                "needs_user_profile": True,
                "requires_human": False,
                "confidence": 0.9,
            }
        )
        return analysis

    topic_rules = [
        ("azure devops", "Azure DevOps access", ["Azure DevOps", "ADO Access"], "access_help", True),
        ("ado", "Azure DevOps access", ["Azure DevOps", "ADO Access"], "access_help", True),
        ("zoho", "Zoho access", ["Zoho"], "access_help", True),
        ("aws", "AWS", ["AWS"], "find_contact", False),
        ("pageindex", "PageIndex", ["PageIndex"], "find_contact", True),
        ("sandy", "Sandy Bot", ["Sandy Bot"], "find_contact", True),
        ("legacy", "legacy modernisation", ["Legacy Modernisation", "Integration"], "find_contact", True),
        ("modernisation", "legacy modernisation", ["Legacy Modernisation", "Integration"], "find_contact", True),
        ("modernization", "legacy modernisation", ["Legacy Modernisation", "Integration"], "find_contact", True),
        ("banking", "banking client support", ["Banking", "Legacy Modernisation"], "find_contact", True),
        ("ai product", "AI products", ["AI Products"], "find_contact", True),
    ]

    for needle, topic, skills, intent, needs_knowledge in topic_rules:
        if needle in text:
            analysis.update(
                {
                    "primary_intent": intent,
                    "topic": topic,
                    "required_skills": skills,
                    "needs_knowledge": needs_knowledge,
                    "needs_contact": True,
                    "requires_human": False,
                    "confidence": 0.82,
                }
            )
            return analysis

    if any(word in text for word in ["expo", "expos", "event", "events", "conference"]):
        asks_what = any(word in text for word in ["what", "which", "when", "attending"])
        analysis.update(
            {
                "primary_intent": "ask_question" if asks_what and not text.strip().startswith("who") else "find_contact",
                "topic": "expo coordination",
                "required_skills": ["Expo Coordination", "Event Logistics"],
                "needs_knowledge": True,
                "needs_contact": True,
                "requires_human": False,
                "confidence": 0.78,
            }
        )
        return analysis

    return analysis


def analyse_user_request(user_message: str, user_profile: dict | None = None) -> dict:
    system_prompt = (
        "You classify Sandy Connect employee-routing requests. "
        "Return strict JSON only. Do not mention or invent employee names. "
        "Use only these primary_intent values: find_contact, ask_question, "
        "manager_lookup, access_help, fallback."
    )
    prompt = f"""
Classify this user request for an internal company connection assistant.

User profile, if known:
{json.dumps(user_profile or {}, indent=2)}

User message:
{user_message}

Return exactly this JSON shape:
{{
  "primary_intent": "find_contact | ask_question | manager_lookup | access_help | fallback",
  "topic": "string or null",
  "required_skills": ["skill strings"],
  "needs_knowledge": true,
  "needs_contact": true,
  "needs_user_profile": false,
  "requires_human": false,
  "confidence": 0.0
}}

Rules:
- "Who works best for AWS?" => topic "AWS", required skill "AWS", needs_contact true.
- "Who should I contact about upcoming expos?" => topic "expo coordination", needs_contact true, needs_knowledge true.
- "Who do I report to?" => manager_lookup, needs_user_profile true, needs_contact true.
- "What expos are Sandhata attending?" => ask_question, topic "upcoming expos", needs_knowledge true.
- "Who handles Zoho access?" => access_help or find_contact, topic "Zoho access", needs_contact true.
- If unclear, use fallback.
"""

    try:
        raw_text = generate_text(prompt, system_prompt=system_prompt)
        parsed = _extract_json(raw_text)
        if parsed is None:
            return _heuristic_analysis(user_message)
        return _normalise_analysis(parsed)
    except LocalLLMError:
        return _heuristic_analysis(user_message)
