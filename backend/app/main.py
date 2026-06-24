from __future__ import annotations

from datetime import timedelta
from typing import Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_

from app.database import (
    ChatMessage,
    ContactRequest,
    DirectMessage,
    Employee,
    Recommendation,
    RecommendationFeedback,
    SessionLocal,
    UserCredential,
    get_db,
    init_db,
    utcnow,
)
from app.services.answer_generator import generate_answer
from app.services.contact_request_service import (
    FEEDBACK_PROMPT_DELAY_SECONDS,
    confirm_recommendation,
    mark_contact_request_fulfilled,
)
from app.services.context_builder import build_context
from app.services.feedback_service import recommendation_id_for_contact_request, store_recommendation_feedback
from app.services.local_llm import get_llm_settings
from app.services.recommendation_engine import recommend_contacts
from app.services.request_analyser import analyse_user_request
from app.services.seed_data import seed_database
from app.auth import get_current_user_dep, require_admin_dep, router as auth_router
from app.messages import router as messages_router
from app.employees import router as employees_router
from app.notifications import router as notifications_router
from app.analytics import router as analytics_router

app = FastAPI(title="Sandy Connect Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(messages_router, prefix="/api/messages", tags=["messages"])
app.include_router(employees_router, prefix="/api/employees", tags=["employees"])
app.include_router(notifications_router, prefix="/api/notifications", tags=["notifications"])
app.include_router(analytics_router, prefix="/api/analytics", tags=["analytics"])


class AskRequest(BaseModel):
    user_id: str | None = None
    user_name: str | None = None
    user_level: str | None = None
    user_role: str | None = None
    user_department: str | None = None
    message: str = Field(..., min_length=1, max_length=4000)
    channel: str | None = None
    session_id: str | None = None


class FeedbackRequest(BaseModel):
    recommendation_id: int | None = None
    contact_request_id: int | None = None
    was_useful: bool | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    correct_employee_name: str | None = None
    feedback_text: str | None = None


class ConfirmRecommendationRequest(BaseModel):
    requester_name: str | None = None
    notification_channel: str = "chat"


class FrontendChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    requester_id: str | None = None
    session_id: str | None = None


def _seed_credentials_if_empty(db) -> None:
    if db.query(UserCredential).count() > 0:
        return

    import bcrypt

    print("Sandy credentials are empty. Auto-seeding...")
    default_password = "Password123!"
    hashed_password = bcrypt.hashpw(default_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    for employee in db.query(Employee).all():
        db.add(
            UserCredential(
                employee_id=employee.id,
                email=employee.email.strip().lower(),
                hashed_password=hashed_password,
            )
        )
    db.commit()
    print("Successfully auto-seeded credentials.")


def _ensure_admin_credential(db) -> None:
    """Promote the configured admin account so RBAC has at least one admin."""
    import os

    admin_email = os.getenv("SANDY_ADMIN_EMAIL", "dev.malhotra@example.com").strip().lower()
    credential = db.query(UserCredential).filter(UserCredential.email == admin_email).first()
    if credential is None:
        print(
            f"WARNING: No credential found for SANDY_ADMIN_EMAIL={admin_email}. "
            "No admin account will be available until one is promoted manually."
        )
        return

    if not credential.is_admin:
        credential.is_admin = True
        db.commit()
        print(f"Promoted {admin_email} to admin.")


@app.on_event("startup")
def on_startup() -> None:
    init_db()

    session = SessionLocal()
    try:
        if session.query(Employee).count() == 0:
            print("Sandy Connect database is empty. Auto-seeding...")
            seed_database(session)
        _seed_credentials_if_empty(session)
        _ensure_admin_credential(session)
    finally:
        session.close()



def _user_profile_from_request(request: AskRequest) -> dict[str, Any]:
    return {
        "user_id": request.user_id,
        "user_name": request.user_name,
        "user_level": request.user_level,
        "user_role": request.user_role,
        "user_department": request.user_department,
        "channel": request.channel,
    }


def _store_interaction(db, request: AskRequest, analysis: dict, recommendations: dict, answer: str) -> dict:
    chat_message = ChatMessage(
        session_id=request.session_id,
        user_id=request.user_id,
        user_name=request.user_name,
        user_level=request.user_level,
        user_role=request.user_role,
        user_department=request.user_department,
        message=request.message,
        bot_response=answer,
        detected_topic=analysis.get("topic"),
    )
    db.add(chat_message)
    db.flush()

    stored_recommendations = {
        "recommended_contacts": [],
        "escalation_contacts": [],
    }

    for recommendation_type, contacts in [
        ("first_contact", recommendations.get("recommended_contacts", [])),
        ("escalation", recommendations.get("escalation_contacts", [])),
    ]:
        output_key = "recommended_contacts" if recommendation_type == "first_contact" else "escalation_contacts"
        for index, contact in enumerate(contacts, start=1):
            recommendation = Recommendation(
                chat_message_id=chat_message.id,
                recommended_employee_id=contact["employee_id"],
                rank=index,
                score=float(contact.get("score") or 0),
                reason=contact.get("reason"),
                recommendation_type=recommendation_type,
            )
            db.add(recommendation)
            db.flush()

            contact_with_id = dict(contact)
            contact_with_id["recommendation_id"] = recommendation.id
            stored_recommendations[output_key].append(contact_with_id)

    db.commit()
    return stored_recommendations


def _build_confirmation_prompt(analysis: dict, stored_recommendations: dict) -> str | None:
    if analysis.get("primary_intent") == "manager_lookup":
        return None
    contacts = stored_recommendations.get("recommended_contacts") or []
    if not contacts:
        return None

    first = contacts[0]
    topic = analysis.get("topic") or "this request"
    return (
        f"Would you like me to send {first['name']} a chat message saying you may "
        f"contact them soon in regards to {topic}? If yes, confirm recommendation_id "
        f"{first['recommendation_id']}."
    )


def _run_sandy_pipeline(db, request: AskRequest) -> dict:
    user_profile = _user_profile_from_request(request)
    analysis = analyse_user_request(request.message, user_profile)
    context = build_context(db, analysis, request.message, user_profile)
    recommendations = recommend_contacts(context)
    answer = generate_answer(request.message, context, recommendations)
    stored_recommendations = _store_interaction(db, request, analysis, recommendations, answer)
    confirmation_prompt = _build_confirmation_prompt(analysis, stored_recommendations)
    response_answer = f"{answer}\n\n{confirmation_prompt}" if confirmation_prompt else answer

    follow_up_required = bool(
        analysis.get("requires_human")
        or context.get("missing_information")
        or not stored_recommendations.get("recommended_contacts")
        or confirmation_prompt
    )

    return {
        "response_type": "sandy_connect_response",
        "analysis": analysis,
        "recommended_contacts": stored_recommendations["recommended_contacts"],
        "escalation_contacts": stored_recommendations["escalation_contacts"],
        "answer": response_answer,
        "confirmation_required": bool(confirmation_prompt),
        "confirmation_prompt": confirmation_prompt,
        "follow_up_required": follow_up_required,
    }


def _ask_request_for_user(request: AskRequest, current_user: dict) -> AskRequest:
    return AskRequest(
        user_id=current_user["employee_id"],
        user_name=current_user["name"],
        user_level=current_user.get("level"),
        user_role=current_user.get("role"),
        user_department=current_user.get("department"),
        message=request.message,
        channel=request.channel,
        session_id=request.session_id,
    )


def _chat_message_belongs_to_user(chat_message: ChatMessage | None, current_user: dict) -> bool:
    if chat_message is None:
        return False
    if chat_message.user_id:
        return chat_message.user_id == current_user["employee_id"]
    return chat_message.user_name == current_user["name"]


def _get_contact_request_for_participant(db, contact_request_id: int, current_user: dict) -> ContactRequest:
    contact_request = db.get(ContactRequest, contact_request_id)
    if contact_request is None:
        raise ValueError(f"Contact request {contact_request_id} was not found.")

    employee_id = current_user["employee_id"]
    if contact_request.requester_employee_id == employee_id:
        return contact_request

    if contact_request.direct_message_id is not None:
        direct_message = db.get(DirectMessage, contact_request.direct_message_id)
        if direct_message and employee_id in {direct_message.sender_id, direct_message.receiver_id}:
            return contact_request

    chat_message = db.get(ChatMessage, contact_request.chat_message_id)
    if _chat_message_belongs_to_user(chat_message, current_user):
        return contact_request

    if contact_request.recommended_employee_id == employee_id:
        return contact_request

    raise PermissionError("You do not have access to this contact request.")


def _recommendation_belongs_to_user(db, recommendation_id: int, current_user: dict) -> bool:
    recommendation = db.get(Recommendation, recommendation_id)
    if recommendation is None:
        raise ValueError(f"Recommendation {recommendation_id} was not found.")
    return _chat_message_belongs_to_user(db.get(ChatMessage, recommendation.chat_message_id), current_user)


@app.get("/health")
def health() -> dict[str, str]:
    settings = get_llm_settings()
    return {
        "status": "ok",
        "llm_provider": "ollama",
        "model": settings["model"],
        "database": "sqlite",
    }


@app.post("/admin/seed")
def admin_seed(current_user: dict = Depends(require_admin_dep), db=Depends(get_db)) -> dict:
    init_db()
    counts = seed_database(db)
    return {"status": "ok", "seeded": counts, "requested_by": current_user["employee_id"]}


@app.post("/ask")
def ask(
    request: AskRequest,
    current_user: dict = Depends(get_current_user_dep),
    db=Depends(get_db),
) -> dict:
    return _run_sandy_pipeline(db, _ask_request_for_user(request, current_user))


@app.post("/recommendations/{recommendation_id}/confirm")
def confirm_recommendation_endpoint(
    recommendation_id: int,
    request: ConfirmRecommendationRequest = ConfirmRecommendationRequest(),
    current_user: dict = Depends(get_current_user_dep),
    db=Depends(get_db),
) -> dict:
    try:
        contact_request = confirm_recommendation(
            db,
            recommendation_id=recommendation_id,
            requester_employee_id=current_user["employee_id"],
            requester_name=request.requester_name or current_user["name"],
            notification_channel=request.notification_channel or "chat",
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return {
        "status": "ok",
        "message": "Chat message sent to the recommended contact.",
        "contact_request": contact_request,
    }


@app.post("/contact-requests/{contact_request_id}/fulfilled")
def contact_request_fulfilled(
    contact_request_id: int,
    current_user: dict = Depends(get_current_user_dep),
    db=Depends(get_db),
) -> dict:
    try:
        _get_contact_request_for_participant(db, contact_request_id, current_user)
        contact_request = mark_contact_request_fulfilled(db, contact_request_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    return {
        "status": "ok",
        "message": "Contact request marked as fulfilled.",
        "contact_request": contact_request,
    }


@app.post("/feedback")
def feedback(
    request: FeedbackRequest,
    current_user: dict = Depends(get_current_user_dep),
    db=Depends(get_db),
) -> dict[str, str]:
    recommendation_id = request.recommendation_id
    try:
        if recommendation_id is None and request.contact_request_id is not None:
            _get_contact_request_for_participant(db, request.contact_request_id, current_user)
            recommendation_id = recommendation_id_for_contact_request(db, request.contact_request_id)
        if recommendation_id is None:
            raise ValueError("Either recommendation_id or contact_request_id is required.")
        if not _recommendation_belongs_to_user(db, recommendation_id, current_user):
            raise PermissionError("You do not have access to this recommendation.")

        store_recommendation_feedback(
            db,
            recommendation_id=recommendation_id,
            was_useful=request.was_useful,
            rating=request.rating,
            correct_employee_name=request.correct_employee_name,
            feedback_text=request.feedback_text,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    return {"status": "ok", "message": "Feedback recorded."}


@app.post("/api/chat")
def frontend_chat(
    request: FrontendChatRequest,
    current_user: dict = Depends(get_current_user_dep),
    db=Depends(get_db),
) -> dict:
    """Compatibility wrapper for the existing frontend; uses the same Sandy pipeline."""
    ask_request = AskRequest(
        user_id=current_user["employee_id"],
        user_name=current_user["name"],
        user_level=current_user.get("level"),
        user_role=current_user.get("role"),
        user_department=current_user.get("department"),
        message=request.message,
        channel="frontend",
        session_id=request.session_id,
    )
    result = _run_sandy_pipeline(db, ask_request)
    recommendations = []
    for contact in result["recommended_contacts"]:
        recommendations.append(
            {
                "recommendation_id": contact.get("recommendation_id"),
                "employee_id": contact["employee_id"],
                "name": contact["name"],
                "designation": contact.get("role") or "",
                "level": contact.get("level") or "",
                "department": contact.get("department") or "",
                "top_skills": [],
                "reason": contact.get("reason") or "",
            }
        )

    return {
        "message": result["answer"],
        "domain": result["analysis"].get("topic") or "general",
        "recommendations": recommendations,
        "session_id": request.session_id or "sandy-connect-session",
        "confirmation_required": result.get("confirmation_required", False),
        "confirmation_prompt": result.get("confirmation_prompt"),
    }


def _feedback_available_at(contact_request: ContactRequest | None):
    if contact_request is None or contact_request.notified_at is None:
        return None
    return contact_request.notified_at + timedelta(seconds=FEEDBACK_PROMPT_DELAY_SECONDS)


def _frontend_recommendations_for_chat_message(db, chat_message_id: int) -> tuple[list[dict], dict[int, dict]]:
    recommendations = (
        db.query(Recommendation)
        .filter(
            Recommendation.chat_message_id == chat_message_id,
            Recommendation.recommendation_type == "first_contact",
        )
        .order_by(Recommendation.rank.asc())
        .all()
    )

    frontend_recommendations: list[dict] = []
    recommendation_states: dict[int, dict] = {}

    for recommendation in recommendations:
        employee = db.get(Employee, recommendation.recommended_employee_id)
        if employee is None:
            continue

        contact_request = (
            db.query(ContactRequest)
            .filter(ContactRequest.recommendation_id == recommendation.id)
            .order_by(ContactRequest.id.desc())
            .first()
        )
        feedback_exists = (
            db.query(RecommendationFeedback)
            .filter(RecommendationFeedback.recommendation_id == recommendation.id)
            .first()
            is not None
        )
        available_at = _feedback_available_at(contact_request)

        frontend_recommendations.append(
            {
                "recommendation_id": recommendation.id,
                "employee_id": employee.id,
                "name": employee.name,
                "designation": employee.role or "",
                "level": employee.level or "",
                "department": employee.department or "",
                "top_skills": [],
                "reason": recommendation.reason or "",
            }
        )

        if contact_request is None:
            recommendation_states[recommendation.id] = {"status": "idle"}
            continue

        prompt_visible = bool(
            available_at is not None
            and available_at <= utcnow()
            and not feedback_exists
        )
        recommendation_states[recommendation.id] = {
            "contactRequestId": contact_request.id,
            "status": "sent",
            "message": "Chat message sent. The conversation is now available in direct messages.",
            "feedbackAvailableAt": available_at.isoformat() if available_at else None,
            "feedbackPromptVisible": prompt_visible,
            "feedbackSubmitted": feedback_exists,
            "feedbackStatus": "sent" if feedback_exists else "idle",
            "feedbackMessage": (
                "Thanks. Sandy will use this feedback for future routing."
                if feedback_exists
                else None
            ),
        }

    return frontend_recommendations, recommendation_states


@app.get("/api/chat/history")
def get_chat_history(
    session_id: str,
    current_user: dict = Depends(get_current_user_dep),
    db=Depends(get_db),
) -> list[dict]:
    messages = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.session_id == session_id,
            or_(
                ChatMessage.user_id == current_user["employee_id"],
                and_(
                    ChatMessage.user_id.is_(None),
                    ChatMessage.user_name == current_user["name"],
                ),
            ),
        )
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    history = []
    for msg in messages:
        recommendations, recommendation_states = _frontend_recommendations_for_chat_message(db, msg.id)
        history.append(
            {
                "id": msg.id,
                "session_id": msg.session_id,
                "message": msg.message,
                "bot_response": msg.bot_response,
                "created_at": msg.created_at,
                "detected_topic": msg.detected_topic,
                "recommendations": recommendations,
                "recommendation_states": recommendation_states,
                "confirmation_required": bool(
                    recommendations
                    and any(state.get("status") == "idle" for state in recommendation_states.values())
                ),
            }
        )
    return history
