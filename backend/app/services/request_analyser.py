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

NON_ACTIONABLE_TOPICS = {"greeting", "help", "thanks", "smalltalk", "out_of_scope"}

GREETINGS = {
    "hi",
    "hello",
    "hey",
    "hola",
    "greetings",
    "good morning",
    "good afternoon",
    "good evening",
    "yo",
    "hi there",
    "hello there",
    "sandy",
    "sandy bot",
}

THANKS = {
    "thanks",
    "thank you",
    "thanks sandy",
    "thank you sandy",
    "cheers",
    "cool thanks",
    "nice thanks",
}

HELP_WORDS = {
    "help",
    "info",
    "information",
    "what can you do",
    "commands",
    "how to use",
    "who are you",
}

OFF_TOPIC_HINTS = {
    "order pizza",
    "buy pizza",
    "book a hotel",
    "book hotel",
    "weather",
    "stock price",
    "movie recommendation",
    "tell me a joke",
    "write a poem",
    "write me a poem",
    "write a story",
    "write me a story",
    "write a song",
    "write me a song",
    "lyrics",
    "play music",
}

ACTION_VERBS = {
    "access",
    "assist",
    "connect",
    "contact",
    "escalate",
    "find",
    "handle",
    "handles",
    "help",
    "know",
    "knows",
    "owner",
    "owns",
    "reach",
    "report",
    "route",
    "speak",
    "support",
    "talk",
}

WORK_CONTEXT_TERMS = {
    "access",
    "client",
    "customer",
    "department",
    "expert",
    "manager",
    "owner",
    "project",
    "report",
    "team",
    "tool",
    "topic",
    "work",
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

    if result["primary_intent"] == "fallback" and str(result.get("topic") or "").lower() in NON_ACTIONABLE_TOPICS:
        result["needs_knowledge"] = False
        result["needs_contact"] = False
        result["needs_user_profile"] = False
        result["requires_human"] = False

    return result


def _clean_text(user_message: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", user_message.lower())).strip()


def _is_greeting(text: str) -> bool:
    if text in GREETINGS:
        return True
    return bool(
        re.fullmatch(
            r"(hi|hello|hey|yo|good morning|good afternoon|good evening) (sandy|sandy bot|bot)",
            text,
        )
    )


def _is_help_request(text: str) -> bool:
    if text in HELP_WORDS:
        return True
    if any(phrase in text for phrase in ["what can you do", "how to use", "how does this work"]):
        return True
    return text in {"sandy help", "help sandy", "help sandy bot"}


def _fallback_topic(topic: str, confidence: float = 0.9) -> dict[str, Any]:
    analysis = _base_analysis()
    analysis.update(
        {
            "topic": topic,
            "requires_human": False,
            "confidence": confidence,
        }
    )
    return analysis


def _extract_generic_topic(text: str) -> str | None:
    patterns = [
        r"\bwho (?:can|could|should|would)?\s*(?:i\s*)?(?:contact|speak to|talk to|reach out to|ask|go to)\s+(?:about|for|regarding|with)\s+(.+)",
        r"\bwho (?:owns|handles|knows|supports|manages)\s+(.+)",
        r"\b(?:can|could) someone help(?: me)?\s+(?:with|on|for)\s+(.+)",
        r"\b(?:i|we) need(?: some)? help\s+(?:with|on|for)\s+(.+)",
        r"\b(?:i|we) need access\s+(?:to|for)\s+(.+)",
        r"\b(?:connect|route|point) me\s+(?:to|towards)\s+(.+)",
        r"\b(?:find|recommend) (?:a|an|the)?\s*(?:person|expert|owner|contact)?\s*(?:for|with|about)\s+(.+)",
        r"\b(?:looking for|need) someone (?:who )?(?:knows|understands|handles|can help with)\s+(.+)",
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            topic = match.group(1).strip(" .?!")
            topic = re.sub(r"\b(please|pls|thanks|thank you)\b", "", topic).strip()
            return topic or None
    return None


def _generic_connect_analysis(text: str) -> dict[str, Any] | None:
    topic = _extract_generic_topic(text)
    tokens = set(text.split())
    has_action = bool(tokens & ACTION_VERBS)
    has_work_context = bool(tokens & WORK_CONTEXT_TERMS)

    if topic:
        intent = "access_help" if "access" in tokens else "find_contact"
        analysis = _base_analysis()
        analysis.update(
            {
                "primary_intent": intent,
                "topic": topic,
                "required_skills": [topic] if len(topic) <= 80 else [],
                "needs_knowledge": False,
                "needs_contact": True,
                "requires_human": False,
                "confidence": 0.68,
            }
        )
        return analysis

    if has_action and has_work_context:
        analysis = _base_analysis()
        analysis.update(
            {
                "primary_intent": "find_contact",
                "topic": None,
                "needs_contact": True,
                "requires_human": True,
                "confidence": 0.45,
            }
        )
        return analysis

    return None


def _heuristic_analysis(user_message: str) -> dict[str, Any]:
    text = _clean_text(user_message)
    analysis = _base_analysis()

    if any(hint in text for hint in OFF_TOPIC_HINTS):
        return _fallback_topic("out_of_scope", confidence=0.85)

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

    generic_analysis = _generic_connect_analysis(text)
    if generic_analysis:
        return generic_analysis

    if text.endswith("?"):
        return _fallback_topic("out_of_scope", confidence=0.65)

    return analysis


def analyse_user_request(user_message: str, user_profile: dict | None = None) -> dict:
    # First check for simple greetings or help requests
    text_clean = _clean_text(user_message)
    
    if _is_greeting(text_clean):
        return _fallback_topic("greeting", confidence=1.0)

    if text_clean in THANKS:
        return _fallback_topic("thanks", confidence=1.0)
        
    if _is_help_request(text_clean):
        return _fallback_topic("help", confidence=1.0)

    system_prompt = (
        "You classify Sandy Connect employee-routing requests. "
        "Return strict JSON only. Do not mention or invent employee names. "
        "Use only these primary_intent values: find_contact, ask_question, "
        "manager_lookup, access_help, fallback. "
        "Only classify internal employee routing, access, manager, project, expertise, "
        "or approved internal knowledge questions as actionable."
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
- Greetings, thanks, social chat, jokes, shopping, food orders, weather, or unrelated personal tasks => fallback, topic "out_of_scope" or "smalltalk", needs_contact false, needs_knowledge false, requires_human false.
- If unclear, use fallback.
"""

    try:
        raw_text = generate_text(prompt, system_prompt=system_prompt)
        parsed = _extract_json(raw_text)
        if parsed is None:
            return _heuristic_analysis(user_message)
        normalised = _normalise_analysis(parsed)
        heuristic = _heuristic_analysis(user_message)
        if heuristic.get("topic") == "out_of_scope" and any(hint in text_clean for hint in OFF_TOPIC_HINTS):
            return heuristic
        if normalised["primary_intent"] == "fallback" and heuristic["primary_intent"] != "fallback":
            return heuristic
        return normalised
    except LocalLLMError:
        return _heuristic_analysis(user_message)
