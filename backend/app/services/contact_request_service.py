from __future__ import annotations

from datetime import timedelta
from typing import Any

from app.database import (
    ChatMessage,
    ContactRequest,
    DirectMessage,
    Employee,
    OutgoingNotification,
    Recommendation,
    utcnow,
)

FEEDBACK_PROMPT_DELAY_SECONDS = 120


def _contact_request_dict(
    contact_request: ContactRequest,
    notification: OutgoingNotification | None = None,
    direct_message: DirectMessage | None = None,
) -> dict[str, Any]:
    notified_at = contact_request.notified_at
    feedback_available_at = (
        notified_at + timedelta(seconds=FEEDBACK_PROMPT_DELAY_SECONDS)
        if notified_at
        else None
    )
    data = {
        "contact_request_id": contact_request.id,
        "recommendation_id": contact_request.recommendation_id,
        "chat_message_id": contact_request.chat_message_id,
        "requester_employee_id": contact_request.requester_employee_id,
        "requester_name": contact_request.requester_name,
        "topic": contact_request.topic,
        "recommended_employee_id": contact_request.recommended_employee_id,
        "status": contact_request.status,
        "notification_channel": contact_request.notification_channel,
        "notification_message": contact_request.notification_message,
        "direct_message_id": contact_request.direct_message_id,
        "notified_at": contact_request.notified_at.isoformat() if contact_request.notified_at else None,
        "feedback_available_at": feedback_available_at.isoformat() if feedback_available_at else None,
        "fulfilled_at": contact_request.fulfilled_at.isoformat() if contact_request.fulfilled_at else None,
    }
    if direct_message is not None:
        data["direct_message"] = {
            "id": direct_message.id,
            "sender_id": direct_message.sender_id,
            "receiver_id": direct_message.receiver_id,
            "message": direct_message.message,
            "timestamp": direct_message.timestamp.isoformat() if direct_message.timestamp else None,
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


def _build_chat_intro_text(chat_message: ChatMessage, employee: Employee, requester_name: str | None) -> tuple[str, str]:
    requester = requester_name or chat_message.user_name or "A colleague"
    topic = chat_message.detected_topic or chat_message.message
    subject = f"Sandy Connect: {requester} may contact you"
    original_request = chat_message.message.strip()
    if len(original_request) > 240:
        original_request = f"{original_request[:237]}..."
    body = (
        f"Sandy Connect: {requester} may contact you soon in regards to {topic}. "
        f"You were recommended as a relevant contact for this request: \"{original_request}\""
    )
    return subject, body


def _latest_notification(db, contact_request_id: int) -> OutgoingNotification | None:
    return (
        db.query(OutgoingNotification)
        .filter(OutgoingNotification.contact_request_id == contact_request_id)
        .order_by(OutgoingNotification.id.desc())
        .first()
    )


def _direct_message_for_request(db, contact_request: ContactRequest) -> DirectMessage | None:
    if contact_request.direct_message_id is None:
        return None
    return db.get(DirectMessage, contact_request.direct_message_id)


def _create_chat_delivery(
    db,
    contact_request: ContactRequest,
    employee: Employee,
    requester_employee_id: str,
    subject: str,
    body: str,
    notification_channel: str,
) -> tuple[OutgoingNotification, DirectMessage]:
    if requester_employee_id == employee.id:
        raise ValueError("Cannot create a contact request to yourself.")

    now = utcnow()
    direct_message = DirectMessage(
        sender_id=requester_employee_id,
        receiver_id=employee.id,
        message=body,
        read=False,
        timestamp=now,
    )
    db.add(direct_message)
    db.flush()

    contact_request.direct_message_id = direct_message.id
    contact_request.requester_employee_id = requester_employee_id
    contact_request.notification_channel = notification_channel
    contact_request.notified_at = contact_request.notified_at or now
    contact_request.updated_at = now

    notification = OutgoingNotification(
        contact_request_id=contact_request.id,
        recipient_employee_id=employee.id,
        recipient_email=None,
        channel=notification_channel,
        subject=subject,
        body=body,
        status="sent_chat",
        sent_at=now,
    )
    db.add(notification)
    return notification, direct_message


def confirm_recommendation(
    db,
    recommendation_id: int,
    requester_employee_id: str,
    requester_name: str | None = None,
    notification_channel: str = "chat",
) -> dict[str, Any]:
    notification_channel = "chat"
    recommendation = db.get(Recommendation, recommendation_id)
    if recommendation is None:
        raise ValueError(f"Recommendation {recommendation_id} was not found.")

    chat_message = db.get(ChatMessage, recommendation.chat_message_id)
    employee = db.get(Employee, recommendation.recommended_employee_id)
    if chat_message is None:
        raise ValueError(f"Chat message {recommendation.chat_message_id} was not found.")
    if employee is None:
        raise ValueError(f"Employee {recommendation.recommended_employee_id} was not found.")
    if chat_message.user_id and chat_message.user_id != requester_employee_id:
        raise ValueError("Recommendation does not belong to the signed-in user.")

    subject, body = _build_chat_intro_text(chat_message, employee, requester_name)

    existing = db.query(ContactRequest).filter(ContactRequest.recommendation_id == recommendation_id).first()
    if existing is not None:
        notification = _latest_notification(db, existing.id)
        direct_message = _direct_message_for_request(db, existing)
        if direct_message is None:
            notification, direct_message = _create_chat_delivery(
                db,
                existing,
                employee,
                requester_employee_id,
                subject,
                body,
                notification_channel,
            )
            existing.notification_message = body
            existing.status = "notified"
            db.commit()
            db.refresh(existing)
            db.refresh(notification)
            db.refresh(direct_message)
        return _contact_request_dict(existing, notification, direct_message)

    now = utcnow()
    contact_request = ContactRequest(
        recommendation_id=recommendation.id,
        chat_message_id=chat_message.id,
        requester_employee_id=requester_employee_id,
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

    notification, direct_message = _create_chat_delivery(
        db,
        contact_request,
        employee,
        requester_employee_id,
        subject,
        body,
        notification_channel,
    )
    db.commit()
    db.refresh(contact_request)
    db.refresh(notification)
    db.refresh(direct_message)
    return _contact_request_dict(contact_request, notification, direct_message)


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
