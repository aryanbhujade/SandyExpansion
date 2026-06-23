from __future__ import annotations

import json
import re

from app.services.local_llm import LocalLLMError, generate_text

MAX_LLM_ANSWER_CHARS = 1400
PRE_CONFIRMATION_ACTION_CLAIMS = [
    "i have notified",
    "i've notified",
    "i notified",
    "i have sent",
    "i've sent",
    "i sent",
    "an email has been sent",
    "a message has been sent",
    "ticket has been created",
    "i created a ticket",
]


def _knowledge_lines(context: dict) -> list[str]:
    lines = []
    for match in context.get("knowledge_matches", [])[:2]:
        summary = match.get("knowledge_summary")
        if summary:
            lines.append(summary)
    return lines


def _format_reason(reason: str | None) -> list[str]:
    if not reason:
        return []
    parts = [part.strip(" .") for part in reason.split(";") if part.strip(" .")]
    return parts[:4]


def _fallback_answer(user_message: str, context: dict, recommendations: dict) -> str:
    analysis = context.get("analysis") or {}

    if analysis.get("topic") == "greeting":
        return "Hello! I'm Sandy, your internal connection assistant. How can I help you today? You can ask me about specific technologies, projects, or who can help next!"

    if analysis.get("topic") == "help":
        return (
            "I can help you discover experts and get system access within your organisation. "
            "Try asking me:\n"
            "- 'Who works best for AWS?'\n"
            "- 'Who can help me with Azure DevOps access?'\n"
            "- 'Who do I report to?'\n"
            "- 'Who owns Zoho access requests?'"
        )

    if analysis.get("topic") == "thanks":
        return "You're welcome. Ask me whenever you need the right colleague, access owner, manager, or internal project contact."

    if analysis.get("topic") in {"smalltalk", "out_of_scope"}:
        return (
            "I can help with internal connection requests, expertise routing, access owners, manager lookups, "
            "and approved company knowledge. I cannot action that request directly."
        )

    recommended = recommendations.get("recommended_contacts") or []
    escalations = recommendations.get("escalation_contacts") or []
    knowledge = _knowledge_lines(context)

    if analysis.get("primary_intent") == "manager_lookup":
        manager = context.get("manager_contact")
        if manager:
            return (
                f"You report to {manager['name']}, {manager.get('level') or ''} "
                f"{manager.get('role') or 'manager'}, in {manager.get('department') or 'the organisation'}."
            ).replace("  ", " ").strip()
        return "I could not confidently find your manager from the current employee data."

    if not recommended:
        missing = context.get("missing_information") or []
        missing_text = "; ".join(item.rstrip(".") for item in missing)
        suffix = f" Missing information: {missing_text}." if missing_text else ""
        return f"Sandy could not find a confident match for this request yet. This should be reviewed by a human coordinator.{suffix}"

    first = recommended[0]
    lines = [
        (
            f"For this request, your best first contact would be {first['name']}, "
            f"{first.get('level') or ''} {first.get('role') or ''}, "
            f"in {first.get('department') or 'the relevant team'}."
        ).replace("  ", " ").strip()
    ]

    reasons = _format_reason(first.get("reason"))
    if reasons:
        lines.append("Why:")
        lines.extend([f"- {reason}." for reason in reasons])

    if knowledge:
        lines.append(f"Context: {knowledge[0]}")

    if escalations:
        escalation = escalations[0]
        lines.append(
            (
                f"If this needs escalation, speak to {escalation['name']}, "
                f"{escalation.get('level') or ''} {escalation.get('role') or ''}."
            ).replace("  ", " ").strip()
        )

    return "\n".join(lines)


def _normalise_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def _mentions_required_grounding(answer: str, context: dict, recommendations: dict) -> bool:
    analysis = context.get("analysis") or {}
    answer_norm = _normalise_text(answer)

    if analysis.get("primary_intent") == "manager_lookup":
        manager = context.get("manager_contact")
        if manager and _normalise_text(manager.get("name")) not in answer_norm:
            return False

    recommended = recommendations.get("recommended_contacts") or []
    if recommended:
        first_contact_name = _normalise_text(recommended[0].get("name"))
        if first_contact_name and first_contact_name not in answer_norm:
            return False

    return True


def _contains_unsupported_action_claim(answer: str) -> bool:
    answer_norm = _normalise_text(answer)
    return any(claim in answer_norm for claim in PRE_CONFIRMATION_ACTION_CLAIMS)


def _contains_external_contact_details(answer: str) -> bool:
    if re.search(r"https?://|www\.", answer, flags=re.IGNORECASE):
        return True
    if re.search(r"\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b", answer, flags=re.IGNORECASE):
        return True
    return False


def _passes_answer_guardrails(answer: str, context: dict, recommendations: dict) -> bool:
    if not answer or not answer.strip():
        return False
    if len(answer) > MAX_LLM_ANSWER_CHARS:
        return False
    if _contains_unsupported_action_claim(answer):
        return False
    if _contains_external_contact_details(answer):
        return False
    return _mentions_required_grounding(answer, context, recommendations)


def generate_answer(user_message: str, context: dict, recommendations: dict) -> str:
    grounding = {
        "user_message": user_message,
        "analysis": context.get("analysis"),
        "knowledge_summaries": _knowledge_lines(context),
        "manager_contact": context.get("manager_contact"),
        "recommended_contacts": recommendations.get("recommended_contacts", []),
        "escalation_contacts": recommendations.get("escalation_contacts", []),
        "missing_information": context.get("missing_information", []),
    }

    if not recommendations.get("recommended_contacts") and not context.get("manager_contact"):
        return _fallback_answer(user_message, context, recommendations)

    system_prompt = (
        "You are Sandy Connect, a hierarchy-aware internal connection assistant. "
        "Write concise professional answers. Use only the contacts and facts in the provided JSON. "
        "Do not invent employee names, policies, departments, clients, or company facts. "
        "Do not claim that a message, ticket, or email has been sent. "
        "Do not include URLs, email addresses, phone numbers, or external instructions."
    )
    prompt = f"""
Format a grounded answer for the employee.

Grounding JSON:
{json.dumps(grounding, indent=2)}

Requirements:
- If there is a recommended first contact, name them and explain why.
- If there is an escalation contact, mention them as escalation only.
- If knowledge summaries are available, include one brief context sentence.
- If this is a manager lookup, answer directly using manager_contact.
- If confidence is low or information is missing, say what could not be confirmed.
- Do not answer unrelated personal, creative, shopping, weather, or general web questions.
- Do not claim that any notification has already been sent.
- Keep the answer short.
"""

    try:
        answer = generate_text(prompt, system_prompt=system_prompt)
    except LocalLLMError:
        return _fallback_answer(user_message, context, recommendations)

    if not answer:
        return _fallback_answer(user_message, context, recommendations)
    if not _passes_answer_guardrails(answer, context, recommendations):
        return _fallback_answer(user_message, context, recommendations)
    return answer
