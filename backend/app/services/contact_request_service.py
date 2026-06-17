from __future__ import annotations

import os
from typing import Any

from app.database import (
    ChatMessage,
    ContactRequest,
    Employee,
    OutgoingNotification,
    Recommendation,
    utcnow,
)

TEST_NOTIFICATION_EMAIL = os.getenv("SANDY_TEST_NOTIFICATION_EMAIL", "aryan.bhujade@sandhata.com")


def _contact_request_dict(contact_request: ContactRequest, notification: OutgoingNotification | None = None) -> dict[str, Any]:
    data = {
        "contact_request_id": contact_request.id,
        "recommendation_id": contact_request.recommendation_id,
        "chat_message_id": contact_request.chat_message_id,
        "requester_name": contact_request.requester_name,
        "topic": contact_request.topic,
        "recommended_employee_id": contact_request.recommended_employee_id,
        "status": contact_request.status,
        "notification_channel": contact_request.notification_channel,
        "notification_message": contact_request.notification_message,
        "notified_at": contact_request.notified_at.isoformat() if contact_request.notified_at else None,
        "fulfilled_at": contact_request.fulfilled_at.isoformat() if contact_request.fulfilled_at else None,
    }
    if notification is not None:
        data["notification"] = {
            "notification_id": notification.id,
            "recipient_employee_id": notification.recipient_employee_id,
            "recipient_email": notification.recipient_email,
            "channel": notification.channel,
            "subject": notification.subject,
            "body": notification.body,
            "status": notification.status,
            "sent_at": notification.sent_at.isoformat() if notification.sent_at else None,
        }
    return data


def _build_notification_text(chat_message: ChatMessage, employee: Employee, requester_name: str | None) -> tuple[str, str]:
    requester = requester_name or chat_message.user_name or "A colleague"
    topic = chat_message.detected_topic or chat_message.message
    subject = f"Sandy Connect: {requester} may contact you"
    body = (
        f"{requester} may contact you soon in regards to {topic}. "
        "Sandy Connect recommended you as a relevant contact based on the request context."
    )
    body += (
        f" Intended recipient: {employee.name} ({employee.email}). "
        f"Testing delivery address: {TEST_NOTIFICATION_EMAIL}."
    )
    return subject, body


def confirm_recommendation(
    db,
    recommendation_id: int,
    requester_name: str | None = None,
    notification_channel: str = "email",
) -> dict[str, Any]:
    recommendation = db.get(Recommendation, recommendation_id)
    if recommendation is None:
        raise ValueError(f"Recommendation {recommendation_id} was not found.")

    existing = db.query(ContactRequest).filter(ContactRequest.recommendation_id == recommendation_id).first()
    if existing is not None:
        notification = (
            db.query(OutgoingNotification)
            .filter(OutgoingNotification.contact_request_id == existing.id)
            .order_by(OutgoingNotification.id.desc())
            .first()
        )
        return _contact_request_dict(existing, notification)

    chat_message = db.get(ChatMessage, recommendation.chat_message_id)
    employee = db.get(Employee, recommendation.recommended_employee_id)
    if chat_message is None:
        raise ValueError(f"Chat message {recommendation.chat_message_id} was not found.")
    if employee is None:
        raise ValueError(f"Employee {recommendation.recommended_employee_id} was not found.")

    subject, body = _build_notification_text(chat_message, employee, requester_name)
    now = utcnow()
    contact_request = ContactRequest(
        recommendation_id=recommendation.id,
        chat_message_id=chat_message.id,
        requester_name=requester_name or chat_message.user_name,
        requester_level=chat_message.user_level,
        requester_role=chat_message.user_role,
        requester_department=chat_message.user_department,
        requester_message=chat_message.message,
        topic=chat_message.detected_topic,
        recommended_employee_id=recommendation.recommended_employee_id,
        status="notified",
        notification_channel=notification_channel,
        notification_message=body,
        notified_at=now,
        updated_at=now,
    )
    db.add(contact_request)
    db.flush()

    notification = OutgoingNotification(
        contact_request_id=contact_request.id,
        recipient_employee_id=employee.id,
        recipient_email=TEST_NOTIFICATION_EMAIL,
        channel=notification_channel,
        subject=subject,
        body=body,
        status="sent_mock",
        sent_at=now,
    )
    db.add(notification)
    db.commit()
    db.refresh(contact_request)
    db.refresh(notification)
    return _contact_request_dict(contact_request, notification)


def mark_contact_request_fulfilled(db, contact_request_id: int) -> dict[str, Any]:
    contact_request = db.get(ContactRequest, contact_request_id)
    if contact_request is None:
        raise ValueError(f"Contact request {contact_request_id} was not found.")

    now = utcnow()
    contact_request.status = "fulfilled"
    contact_request.fulfilled_at = now
    contact_request.updated_at = now
    db.commit()
    db.refresh(contact_request)

    result = _contact_request_dict(contact_request)
    result["feedback_prompt"] = (
        "Did this recommendation help solve your query? "
        "Please rate it from 1 to 5 and optionally add a line or two about what happened."
    )
    result["feedback_payload_hint"] = {
        "contact_request_id": contact_request.id,
        "recommendation_id": contact_request.recommendation_id,
        "was_useful": True,
        "rating": 5,
        "feedback_text": "A short note about whether this contact helped.",
    }
    return result
