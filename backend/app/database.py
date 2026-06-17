from __future__ import annotations

import os
from datetime import datetime

from dotenv import load_dotenv
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sandy_connect.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def utcnow() -> datetime:
    return datetime.utcnow()


class Employee(Base):
    __tablename__ = "employees"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    email = Column(String, nullable=False, unique=True, index=True)
    level = Column(String, nullable=True, index=True)
    role = Column(String, nullable=True)
    department = Column(String, nullable=True, index=True)
    business_unit = Column(String, nullable=True, index=True)
    manager_id = Column(String, ForeignKey("employees.id"), nullable=True)
    location = Column(String, nullable=True)


class EmployeeProfile(Base):
    __tablename__ = "employee_profiles"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employees.id"), nullable=False, unique=True, index=True)
    skills_json = Column(Text, nullable=False, default="[]")
    expertise_topics_json = Column(Text, nullable=False, default="[]")
    projects_json = Column(Text, nullable=False, default="[]")
    notes = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=False, default=0.8)
    last_updated = Column(DateTime, nullable=False, default=utcnow)


class ResponsibilityTopic(Base):
    __tablename__ = "responsibility_topics"

    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String, nullable=False, unique=True, index=True)
    keywords_json = Column(Text, nullable=False, default="[]")
    primary_contact_id = Column(String, ForeignKey("employees.id"), nullable=True)
    backup_contact_id = Column(String, ForeignKey("employees.id"), nullable=True)
    knowledge_summary = Column(Text, nullable=True)
    source = Column(String, nullable=True)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_name = Column(String, nullable=True, index=True)
    user_level = Column(String, nullable=True)
    user_role = Column(String, nullable=True)
    user_department = Column(String, nullable=True, index=True)
    message = Column(Text, nullable=False)
    bot_response = Column(Text, nullable=False)
    detected_topic = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    chat_message_id = Column(Integer, ForeignKey("chat_messages.id"), nullable=False, index=True)
    recommended_employee_id = Column(String, ForeignKey("employees.id"), nullable=False, index=True)
    rank = Column(Integer, nullable=False)
    score = Column(Float, nullable=False)
    reason = Column(Text, nullable=True)
    recommendation_type = Column(String, nullable=False, default="first_contact")
    created_at = Column(DateTime, nullable=False, default=utcnow)


class RecommendationFeedback(Base):
    __tablename__ = "recommendation_feedback"

    id = Column(Integer, primary_key=True, index=True)
    recommendation_id = Column(Integer, ForeignKey("recommendations.id"), nullable=False, index=True)
    was_useful = Column(Boolean, nullable=True)
    rating = Column(Integer, nullable=True)
    correct_employee_name = Column(String, nullable=True)
    feedback_text = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)


class ContactRequest(Base):
    __tablename__ = "contact_requests"

    id = Column(Integer, primary_key=True, index=True)
    recommendation_id = Column(Integer, ForeignKey("recommendations.id"), nullable=False, index=True)
    chat_message_id = Column(Integer, ForeignKey("chat_messages.id"), nullable=False, index=True)
    requester_name = Column(String, nullable=True, index=True)
    requester_level = Column(String, nullable=True)
    requester_role = Column(String, nullable=True)
    requester_department = Column(String, nullable=True)
    requester_message = Column(Text, nullable=False)
    topic = Column(String, nullable=True, index=True)
    recommended_employee_id = Column(String, ForeignKey("employees.id"), nullable=False, index=True)
    status = Column(String, nullable=False, default="notified", index=True)
    notification_channel = Column(String, nullable=False, default="email")
    notification_message = Column(Text, nullable=False)
    notified_at = Column(DateTime, nullable=True)
    fulfilled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow)


class OutgoingNotification(Base):
    __tablename__ = "outgoing_notifications"

    id = Column(Integer, primary_key=True, index=True)
    contact_request_id = Column(Integer, ForeignKey("contact_requests.id"), nullable=False, index=True)
    recipient_employee_id = Column(String, ForeignKey("employees.id"), nullable=False, index=True)
    recipient_email = Column(String, nullable=True)
    channel = Column(String, nullable=False, default="email")
    subject = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    status = Column(String, nullable=False, default="sent_mock", index=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    sent_at = Column(DateTime, nullable=True)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
