from __future__ import annotations

import os
from datetime import datetime

from dotenv import load_dotenv
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, String, Text, create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sandy_connect.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


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


class UserCredential(Base):
    __tablename__ = "credentials"

    employee_id = Column(String, ForeignKey("employees.id"), primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)


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
    __table_args__ = (
        Index("ix_chat_messages_user_session_created", "user_id", "session_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=True)
    user_id = Column(String, ForeignKey("employees.id"), nullable=True, index=True)
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
    __table_args__ = (
        Index("ix_recommendations_chat_rank", "chat_message_id", "rank"),
    )

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
    __table_args__ = (
        Index("ix_contact_requests_recommended_status", "recommended_employee_id", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    recommendation_id = Column(Integer, ForeignKey("recommendations.id"), nullable=False, index=True)
    chat_message_id = Column(Integer, ForeignKey("chat_messages.id"), nullable=False, index=True)
    requester_employee_id = Column(String, ForeignKey("employees.id"), nullable=True, index=True)
    requester_name = Column(String, nullable=True, index=True)
    requester_level = Column(String, nullable=True)
    requester_role = Column(String, nullable=True)
    requester_department = Column(String, nullable=True)
    requester_message = Column(Text, nullable=False)
    topic = Column(String, nullable=True, index=True)
    recommended_employee_id = Column(String, ForeignKey("employees.id"), nullable=False, index=True)
    status = Column(String, nullable=False, default="notified", index=True)
    notification_channel = Column(String, nullable=False, default="chat")
    notification_message = Column(Text, nullable=False)
    direct_message_id = Column(Integer, ForeignKey("direct_messages.id"), nullable=True)
    notified_at = Column(DateTime, nullable=True)
    fulfilled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow)


class OutgoingNotification(Base):
    __tablename__ = "outgoing_notifications"
    __table_args__ = (
        Index("ix_outgoing_notifications_recipient_created", "recipient_employee_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    contact_request_id = Column(Integer, ForeignKey("contact_requests.id"), nullable=False, index=True)
    recipient_employee_id = Column(String, ForeignKey("employees.id"), nullable=False, index=True)
    recipient_email = Column(String, nullable=True)
    channel = Column(String, nullable=False, default="chat")
    subject = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    status = Column(String, nullable=False, default="sent_chat", index=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    sent_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)


class DirectMessage(Base):
    __tablename__ = "direct_messages"
    __table_args__ = (
        Index("ix_direct_messages_sender_receiver_time", "sender_id", "receiver_id", "timestamp"),
        Index("ix_direct_messages_receiver_read", "receiver_id", "read"),
    )

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(String, ForeignKey("employees.id"), nullable=False, index=True)
    receiver_id = Column(String, ForeignKey("employees.id"), nullable=False, index=True)
    message = Column(Text, nullable=False)
    read = Column(Boolean, nullable=False, default=False)
    timestamp = Column(DateTime, nullable=False, default=utcnow)


def _ensure_sqlite_column(table_name: str, column_name: str, column_definition: str) -> None:
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.begin() as conn:
        table_exists = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name=:table_name"),
            {"table_name": table_name},
        ).first()
        if table_exists is None:
            return

        columns = {
            row[1]
            for row in conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
        }
        if column_name not in columns:
            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}"))


def _ensure_sqlite_index(index_name: str, table_name: str, columns_sql: str) -> None:
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.begin() as conn:
        table_exists = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name=:table_name"),
            {"table_name": table_name},
        ).first()
        if table_exists is not None:
            conn.execute(text(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} ({columns_sql})"))


def _ensure_local_schema_updates() -> None:
    _ensure_sqlite_column("chat_messages", "session_id", "VARCHAR")
    _ensure_sqlite_column("chat_messages", "user_id", "VARCHAR")
    _ensure_sqlite_column("direct_messages", "read", "BOOLEAN DEFAULT 0")
    _ensure_sqlite_column("contact_requests", "requester_employee_id", "VARCHAR")
    _ensure_sqlite_column("contact_requests", "direct_message_id", "INTEGER")
    _ensure_sqlite_column("outgoing_notifications", "read_at", "DATETIME")
    _ensure_sqlite_index("ix_chat_messages_user_session_created", "chat_messages", "user_id, session_id, created_at")
    _ensure_sqlite_index("ix_recommendations_chat_rank", "recommendations", "chat_message_id, rank")
    _ensure_sqlite_index("ix_contact_requests_recommended_status", "contact_requests", "recommended_employee_id, status")
    _ensure_sqlite_index("ix_contact_requests_requester_status", "contact_requests", "requester_employee_id, status")
    _ensure_sqlite_index(
        "ix_outgoing_notifications_recipient_created",
        "outgoing_notifications",
        "recipient_employee_id, created_at",
    )
    _ensure_sqlite_index("ix_direct_messages_sender_receiver_time", "direct_messages", "sender_id, receiver_id, timestamp")
    _ensure_sqlite_index("ix_direct_messages_receiver_read", "direct_messages", "receiver_id, read")


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_local_schema_updates()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
