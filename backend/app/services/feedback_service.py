from __future__ import annotations

import re
from typing import Any

from app.database import ChatMessage, ContactRequest, Recommendation, RecommendationFeedback


def _normalise_topic(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def _topic_tokens(value: str | None) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]+", _normalise_topic(value)) if len(token) > 2}


def _topic_multiplier(current_topic: str | None, feedback_topic: str | None) -> float:
    current_norm = _normalise_topic(current_topic)
    feedback_norm = _normalise_topic(feedback_topic)
    if not current_norm:
        return 1.0
    if not feedback_norm:
        return 0.25
    if current_norm == feedback_norm or current_norm in feedback_norm or feedback_norm in current_norm:
        return 1.0
    if _topic_tokens(current_norm) & _topic_tokens(feedback_norm):
        return 0.5
    return 0.0


def store_recommendation_feedback(
    db,
    recommendation_id: int,
    was_useful: bool | None = None,
    rating: int | None = None,
    correct_employee_name: str | None = None,
    feedback_text: str | None = None,
) -> RecommendationFeedback:
    recommendation = db.get(Recommendation, recommendation_id)
    if recommendation is None:
        raise ValueError(f"Recommendation {recommendation_id} was not found.")

    clean_rating = None
    if rating is not None:
        clean_rating = max(1, min(5, int(rating)))

    feedback = RecommendationFeedback(
        recommendation_id=recommendation_id,
        was_useful=was_useful,
        rating=clean_rating,
        correct_employee_name=correct_employee_name,
        feedback_text=feedback_text,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


def recommendation_id_for_contact_request(db, contact_request_id: int) -> int:
    contact_request = db.get(ContactRequest, contact_request_id)
    if contact_request is None:
        raise ValueError(f"Contact request {contact_request_id} was not found.")
    return int(contact_request.recommendation_id)


def calculate_feedback_adjustment_scores(
    db,
    employee_ids: list[str] | None = None,
    topic: str | None = None,
) -> dict[str, dict[str, Any]]:
    query = (
        db.query(Recommendation, RecommendationFeedback, ChatMessage)
        .join(RecommendationFeedback, RecommendationFeedback.recommendation_id == Recommendation.id)
        .join(ChatMessage, ChatMessage.id == Recommendation.chat_message_id)
    )
    if employee_ids:
        query = query.filter(Recommendation.recommended_employee_id.in_(employee_ids))

    signals: dict[str, dict[str, Any]] = {}
    for recommendation, feedback, chat_message in query.all():
        multiplier = _topic_multiplier(topic, chat_message.detected_topic)
        if multiplier <= 0:
            continue

        employee_id = recommendation.recommended_employee_id
        employee_signal = signals.setdefault(
            employee_id,
            {
                "employee_id": employee_id,
                "positive_count": 0,
                "negative_count": 0,
                "rating_total": 0,
                "rating_count": 0,
                "score_adjustment": 0,
                "topics": {},
            },
        )
        topic_key = chat_message.detected_topic or "unknown"
        topic_signal = employee_signal["topics"].setdefault(
            topic_key,
            {
                "positive_count": 0,
                "negative_count": 0,
                "rating_total": 0,
                "rating_count": 0,
            },
        )

        if feedback.rating is not None:
            employee_signal["rating_total"] += feedback.rating
            employee_signal["rating_count"] += 1
            topic_signal["rating_total"] += feedback.rating
            topic_signal["rating_count"] += 1
            employee_signal["score_adjustment"] += (feedback.rating - 3) * 2 * multiplier

        if feedback.was_useful is True:
            employee_signal["positive_count"] += 1
            topic_signal["positive_count"] += 1
            employee_signal["score_adjustment"] += 5 * multiplier
        elif feedback.was_useful is False:
            employee_signal["negative_count"] += 1
            topic_signal["negative_count"] += 1
            employee_signal["score_adjustment"] -= 8 * multiplier

    for employee_signal in signals.values():
        rating_count = employee_signal["rating_count"]
        employee_signal["average_rating"] = (
            round(employee_signal["rating_total"] / rating_count, 2) if rating_count else None
        )
        employee_signal["score_adjustment"] = int(round(employee_signal["score_adjustment"]))
        for topic_signal in employee_signal["topics"].values():
            topic_rating_count = topic_signal["rating_count"]
            topic_signal["average_rating"] = (
                round(topic_signal["rating_total"] / topic_rating_count, 2) if topic_rating_count else None
            )

    return signals
