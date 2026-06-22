from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List
from pydantic import BaseModel, Field, field_validator
from datetime import datetime

from app.database import get_db, DirectMessage, Employee
from app.auth import get_current_user_dep

router = APIRouter()

class MessageCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)

    @field_validator("message")
    @classmethod
    def message_must_have_content(cls, value: str) -> str:
        clean_value = value.strip()
        if not clean_value:
            raise ValueError("Message cannot be empty")
        return clean_value

class MessageResponse(BaseModel):
    id: int
    sender_id: str
    receiver_id: str
    message: str
    timestamp: datetime

    class Config:
        from_attributes = True

from sqlalchemy import or_, and_, func

@router.get("/conversations/active")
def get_active_conversations(current_user: dict = Depends(get_current_user_dep), db: Session = Depends(get_db)):
    my_id = current_user["employee_id"]
    all_dms = db.query(DirectMessage).filter(
        or_(DirectMessage.sender_id == my_id, DirectMessage.receiver_id == my_id)
    ).order_by(DirectMessage.timestamp.asc()).all()
    
    conversations = {}
    for dm in all_dms:
        colleague_id = dm.receiver_id if dm.sender_id == my_id else dm.sender_id
        conversations[colleague_id] = {
            "last_message": dm.message,
            "timestamp": dm.timestamp.isoformat() + "Z" if not dm.timestamp.isoformat().endswith("Z") else dm.timestamp.isoformat(),
            "sender_id": dm.sender_id,
            "read": dm.read
        }
    return conversations

@router.get("/unread/count")
def get_unread_counts(current_user: dict = Depends(get_current_user_dep), db: Session = Depends(get_db)):
    my_id = current_user["employee_id"]
    unread = db.query(
        DirectMessage.sender_id,
        func.count(DirectMessage.id)
    ).filter(
        DirectMessage.receiver_id == my_id,
        DirectMessage.read == False
    ).group_by(DirectMessage.sender_id).all()
    return {sender_id: count for sender_id, count in unread}

@router.get("/{employee_id}", response_model=List[MessageResponse])
def get_messages(employee_id: str, current_user: dict = Depends(get_current_user_dep), db: Session = Depends(get_db)):
    if not db.get(Employee, employee_id):
        raise HTTPException(status_code=404, detail="Employee not found")
        
    # Mark unread messages from this employee to current user as read
    db.query(DirectMessage).filter(
        DirectMessage.sender_id == employee_id,
        DirectMessage.receiver_id == current_user["employee_id"],
        DirectMessage.read == False
    ).update({DirectMessage.read: True})
    db.commit()
    
    messages = db.query(DirectMessage).filter(
        or_(
            and_(DirectMessage.sender_id == current_user["employee_id"], DirectMessage.receiver_id == employee_id),
            and_(DirectMessage.sender_id == employee_id, DirectMessage.receiver_id == current_user["employee_id"])
        )
    ).order_by(DirectMessage.timestamp.asc()).all()
    return messages

@router.post("/{employee_id}", response_model=MessageResponse)
def send_message(employee_id: str, payload: MessageCreate, current_user: dict = Depends(get_current_user_dep), db: Session = Depends(get_db)):
    if employee_id == current_user["employee_id"]:
        raise HTTPException(status_code=400, detail="You cannot message yourself")
    if not db.get(Employee, employee_id):
        raise HTTPException(status_code=404, detail="Employee not found")
    new_message = DirectMessage(
        sender_id=current_user["employee_id"],
        receiver_id=employee_id,
        message=payload.message,
        read=False
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    return new_message
