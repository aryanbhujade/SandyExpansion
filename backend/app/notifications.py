from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db, OutgoingNotification, ContactRequest
from app.auth import get_current_user_dep

router = APIRouter()

class NotificationResponse(BaseModel):
    id: int
    chat_log_id: int | None
    notified_emp_id: str
    requester_id: str | None
    requester_name: str | None
    channel: str
    status: str
    topic: str
    sent_at: datetime | None
    read_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("", response_model=List[NotificationResponse])
def get_notifications(current_user: dict = Depends(get_current_user_dep), db: Session = Depends(get_db)):
    employee_id = current_user["employee_id"]
    
    notifications = db.query(OutgoingNotification).filter(
        OutgoingNotification.recipient_employee_id == employee_id
    ).order_by(OutgoingNotification.created_at.desc()).all()
    
    response = []
    for notif in notifications:
        contact_req = db.query(ContactRequest).filter(ContactRequest.id == notif.contact_request_id).first()
        
        chat_log_id = contact_req.chat_message_id if contact_req else None
        requester_id = contact_req.requester_employee_id if contact_req else None
        requester_name = contact_req.requester_name if contact_req else None
        topic = contact_req.topic if contact_req and contact_req.topic else notif.subject
        
        response.append({
            "id": notif.id,
            "chat_log_id": chat_log_id,
            "notified_emp_id": notif.recipient_employee_id,
            "requester_id": requester_id,
            "requester_name": requester_name,
            "channel": notif.channel,
            "status": notif.status,
            "topic": topic,
            "sent_at": notif.sent_at,
            "read_at": notif.read_at,
            "created_at": notif.created_at
        })
        
    return response

@router.put("/{notification_id}/read")
def mark_notification_read(notification_id: int, current_user: dict = Depends(get_current_user_dep), db: Session = Depends(get_db)):
    notif = db.query(OutgoingNotification).filter(
        OutgoingNotification.id == notification_id,
        OutgoingNotification.recipient_employee_id == current_user["employee_id"]
    ).first()
    
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    from datetime import datetime
    notif.read_at = datetime.utcnow()
    db.commit()
    
    return {"status": "ok"}
