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

@router.get("/{employee_id}", response_model=List[MessageResponse])
def get_messages(employee_id: str, current_user: dict = Depends(get_current_user_dep), db: Session = Depends(get_db)):
    if not db.get(Employee, employee_id):
        raise HTTPException(status_code=404, detail="Employee not found")
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
        message=payload.message
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    return new_message
