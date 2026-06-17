from __future__ import annotations

from typing import Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.database import ChatMessage, Recommendation, get_db, init_db
from app.services.answer_generator import generate_answer
from app.services.contact_request_service import confirm_recommendation, mark_contact_request_fulfilled
from app.services.context_builder import build_context
from app.services.feedback_service import recommendation_id_for_contact_request, store_recommendation_feedback
from app.services.local_llm import get_llm_settings
from app.services.recommendation_engine import recommend_contacts
from app.services.request_analyser import analyse_user_request
from app.services.seed_data import seed_database

app = FastAPI(title="Sandy Connect Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskRequest(BaseModel):
    user_id: str | None = None
    user_name: str | None = None
    user_level: str | None = None
    user_role: str | None = None
    user_department: str | None = None
    message: str = Field(..., min_length=1)
    channel: str | None = None


class FeedbackRequest(BaseModel):
    recommendation_id: int | None = None
    contact_request_id: int | None = None
    was_useful: bool | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    correct_employee_name: str | None = None
    feedback_text: str | None = None


class ConfirmRecommendationRequest(BaseModel):
    requester_name: str | None = None
    notification_channel: str = "email"


class FrontendChatRequest(BaseModel):
    message: str
    requester_id: str | None = None
    session_id: str | None = None


@app.on_event("startup")
def on_startup() -> None:
    init_db()


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
        f"Would you like me to notify {first['name']} that you may contact them "
        f"soon in regards to {topic}? If yes, confirm recommendation_id "
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
def admin_seed(db=Depends(get_db)) -> dict:
    init_db()
    counts = seed_database(db)
    return {"status": "ok", "seeded": counts}


@app.post("/ask")
def ask(request: AskRequest, db=Depends(get_db)) -> dict:
    return _run_sandy_pipeline(db, request)


@app.post("/recommendations/{recommendation_id}/confirm")
def confirm_recommendation_endpoint(
    recommendation_id: int,
    request: ConfirmRecommendationRequest = ConfirmRecommendationRequest(),
    db=Depends(get_db),
) -> dict:
    try:
        contact_request = confirm_recommendation(
            db,
            recommendation_id=recommendation_id,
            requester_name=request.requester_name,
            notification_channel=request.notification_channel,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return {
        "status": "ok",
        "message": "Recommended contact has been notified.",
        "contact_request": contact_request,
    }


@app.post("/contact-requests/{contact_request_id}/fulfilled")
def contact_request_fulfilled(contact_request_id: int, db=Depends(get_db)) -> dict:
    try:
        contact_request = mark_contact_request_fulfilled(db, contact_request_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return {
        "status": "ok",
        "message": "Contact request marked as fulfilled.",
        "contact_request": contact_request,
    }


@app.post("/feedback")
def feedback(request: FeedbackRequest, db=Depends(get_db)) -> dict[str, str]:
    recommendation_id = request.recommendation_id
    try:
        if recommendation_id is None and request.contact_request_id is not None:
            recommendation_id = recommendation_id_for_contact_request(db, request.contact_request_id)
        if recommendation_id is None:
            raise ValueError("Either recommendation_id or contact_request_id is required.")

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

    return {"status": "ok", "message": "Feedback recorded."}


@app.post("/api/chat")
def frontend_chat(request: FrontendChatRequest, db=Depends(get_db)) -> dict:
    """Compatibility wrapper for the existing frontend; uses the same Sandy pipeline."""
    ask_request = AskRequest(
        user_id=request.requester_id,
        user_name=request.requester_id,
        message=request.message,
        channel="frontend",
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
