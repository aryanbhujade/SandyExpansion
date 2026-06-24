from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import require_admin_dep
from app.database import (
    ChatMessage,
    ContactRequest,
    DirectMessage,
    Employee,
    OutgoingNotification,
    Recommendation,
    RecommendationFeedback,
    get_db,
)

router = APIRouter()


def _paginated(page: int, limit: int) -> dict[str, Any]:
    return {"page": page, "limit": limit, "total": 0, "items": []}


@router.get("/summary")
def analytics_summary(
    current_user: dict = Depends(require_admin_dep),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """High-level platform counts and top breakdowns. Admin-only."""
    total_employees = db.query(Employee).count()
    active_users = (
        db.query(func.count(func.distinct(ChatMessage.user_id)))
        .filter(ChatMessage.user_id.isnot(None))
        .scalar()
        or 0
    )

    total_chat_messages = db.query(ChatMessage).count()
    total_recommendations = db.query(Recommendation).count()
    confirmed = db.query(ContactRequest).count()
    fulfilled = (
        db.query(ContactRequest)
        .filter(ContactRequest.status == "fulfilled")
        .count()
    )
    total_feedback = db.query(RecommendationFeedback).count()

    avg_rating_row = db.query(func.avg(RecommendationFeedback.rating)).scalar()
    avg_rating = round(float(avg_rating_row), 2) if avg_rating_row else 0.0

    positive = (
        db.query(RecommendationFeedback)
        .filter(RecommendationFeedback.was_useful.is_(True))
        .count()
    )
    feedback_useful_pct = round((positive / total_feedback) * 100, 1) if total_feedback else 0.0

    direct_messages = db.query(DirectMessage).count()
    notifications = db.query(OutgoingNotification).count()
    unread_notifications = (
        db.query(OutgoingNotification).filter(OutgoingNotification.read_at.is_(None)).count()
    )

    # Top requested topics (from chat_messages.detected_topic).
    topic_rows = (
        db.query(ChatMessage.detected_topic, func.count(ChatMessage.id))
        .filter(ChatMessage.detected_topic.isnot(None))
        .group_by(ChatMessage.detected_topic)
        .order_by(func.count(ChatMessage.id).desc())
        .limit(5)
        .all()
    )
    top_topics = [{"topic": name, "count": count} for name, count in topic_rows if name]

    # Recommendations distributed by recommended employee department.
    dept_rows = (
        db.query(Employee.department, func.count(Recommendation.id))
        .join(Recommendation, Recommendation.recommended_employee_id == Employee.id)
        .group_by(Employee.department)
        .order_by(func.count(Recommendation.id).desc())
        .limit(5)
        .all()
    )
    by_department = [{"department": dept or "Unknown", "count": count} for dept, count in dept_rows]

    return {
        "totals": {
            "employees": total_employees,
            "active_users": active_users,
            "chat_messages": total_chat_messages,
            "recommendations": total_recommendations,
            "confirmed_recommendations": confirmed,
            "fulfilled_requests": fulfilled,
            "feedback": total_feedback,
            "direct_messages": direct_messages,
            "notifications": notifications,
            "unread_notifications": unread_notifications,
        },
        "feedback": {
            "average_rating": avg_rating,
            "useful_percentage": feedback_useful_pct,
        },
        "top_topics": top_topics,
        "recommendations_by_department": by_department,
    }


@router.get("/recommendations")
def analytics_recommendations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_admin_dep),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Recommendations with their confirm/feedback status. Admin-only."""
    base_query = db.query(Recommendation)
    total = base_query.count()

    rows = (
        base_query.order_by(Recommendation.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    items: list[dict[str, Any]] = []
    for rec in rows:
        chat = db.get(ChatMessage, rec.chat_message_id)
        recommended = db.get(Employee, rec.recommended_employee_id)
        contact_request = (
            db.query(ContactRequest)
            .filter(ContactRequest.recommendation_id == rec.id)
            .order_by(ContactRequest.id.desc())
            .first()
        )
        feedback = (
            db.query(RecommendationFeedback)
            .filter(RecommendationFeedback.recommendation_id == rec.id)
            .order_by(RecommendationFeedback.id.desc())
            .first()
        )

        items.append(
            {
                "id": rec.id,
                "created_at": rec.created_at,
                "rank": rec.rank,
                "score": rec.score,
                "type": rec.recommendation_type,
                "reason": rec.reason,
                "requester": {
                    "employee_id": chat.user_id if chat else None,
                    "name": chat.user_name if chat else None,
                },
                "recommended": {
                    "employee_id": rec.recommended_employee_id,
                    "name": recommended.name if recommended else None,
                    "department": recommended.department if recommended else None,
                    "level": recommended.level if recommended else None,
                },
                "topic": chat.detected_topic if chat else None,
                "contact_request": (
                    {"status": contact_request.status, "id": contact_request.id}
                    if contact_request
                    else None
                ),
                "feedback": (
                    {
                        "was_useful": feedback.was_useful,
                        "rating": feedback.rating,
                        "id": feedback.id,
                    }
                    if feedback
                    else None
                ),
            }
        )

    return {"page": page, "limit": limit, "total": total, "items": items}


@router.get("/feedback")
def analytics_feedback(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_admin_dep),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Submitted recommendation feedback. Admin-only."""
    base_query = db.query(RecommendationFeedback)
    total = base_query.count()

    rows = (
        base_query.order_by(RecommendationFeedback.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    items: list[dict[str, Any]] = []
    for fb in rows:
        rec = db.get(Recommendation, fb.recommendation_id)
        chat = db.get(ChatMessage, rec.chat_message_id) if rec else None
        recommended = db.get(Employee, rec.recommended_employee_id) if rec else None
        items.append(
            {
                "id": fb.id,
                "created_at": fb.created_at,
                "was_useful": fb.was_useful,
                "rating": fb.rating,
                "correct_employee_name": fb.correct_employee_name,
                "feedback_text": fb.feedback_text,
                "topic": chat.detected_topic if chat else None,
                "recommended": (
                    {
                        "employee_id": rec.recommended_employee_id,
                        "name": recommended.name if recommended else None,
                    }
                    if rec
                    else None
                ),
            }
        )

    return {"page": page, "limit": limit, "total": total, "items": items}


@router.get("/chat-messages")
def analytics_chat_messages(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_admin_dep),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Sandy bot chat log (admin moderation view). Admin-only."""
    base_query = db.query(ChatMessage)
    total = base_query.count()

    rows = (
        base_query.order_by(ChatMessage.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    items: list[dict[str, Any]] = []
    for msg in rows:
        rec_count = (
            db.query(Recommendation)
            .filter(Recommendation.chat_message_id == msg.id)
            .count()
        )
        items.append(
            {
                "id": msg.id,
                "created_at": msg.created_at,
                "session_id": msg.session_id,
                "user_id": msg.user_id,
                "user_name": msg.user_name,
                "user_department": msg.user_department,
                "message": msg.message,
                "detected_topic": msg.detected_topic,
                "recommendation_count": rec_count,
            }
        )

    return {"page": page, "limit": limit, "total": total, "items": items}


@router.delete("/chat-messages/{chat_message_id}")
def analytics_delete_chat_message(
    chat_message_id: int,
    current_user: dict = Depends(require_admin_dep),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Delete a chat message and its recommendations, contact requests,
    notifications, and feedback (admin moderation). Direct messages between
    employees are intentionally left intact. Admin-only."""
    chat_message = db.get(ChatMessage, chat_message_id)
    if chat_message is None:
        raise HTTPException(status_code=404, detail="Chat message not found.")

    recommendations = (
        db.query(Recommendation)
        .filter(Recommendation.chat_message_id == chat_message_id)
        .all()
    )

    for rec in recommendations:
        db.query(RecommendationFeedback).filter(
            RecommendationFeedback.recommendation_id == rec.id
        ).delete(synchronize_session=False)
        contact_requests = (
            db.query(ContactRequest)
            .filter(ContactRequest.recommendation_id == rec.id)
            .all()
        )
        for cr in contact_requests:
            db.query(OutgoingNotification).filter(
                OutgoingNotification.contact_request_id == cr.id
            ).delete(synchronize_session=False)
            db.delete(cr)
        db.delete(rec)

    db.delete(chat_message)
    db.commit()
    return {"status": "ok", "message": "Chat message and associated records deleted."}


@router.delete("/feedback/{feedback_id}")
def analytics_delete_feedback(
    feedback_id: int,
    current_user: dict = Depends(require_admin_dep),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Delete a single feedback entry (admin moderation). Admin-only."""
    feedback = db.get(RecommendationFeedback, feedback_id)
    if feedback is None:
        raise HTTPException(status_code=404, detail="Feedback not found.")
    db.delete(feedback)
    db.commit()
    return {"status": "ok", "message": "Feedback deleted."}