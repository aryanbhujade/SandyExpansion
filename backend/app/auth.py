from datetime import datetime, timedelta, timezone
import os
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import bcrypt

from sqlalchemy.orm import Session
from app.database import Employee, UserCredential, get_db

SECRET_KEY = os.getenv("SANDY_JWT_SECRET", "internbot-local-development-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str, db: Session):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        employee_id: str = payload.get("sub")
        if employee_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    user_cred = db.query(UserCredential).filter(UserCredential.employee_id == employee_id).first()
    if user_cred is None:
        raise HTTPException(status_code=401, detail="User not found")
        
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=401, detail="Employee details not found")
        
    return {
        "employee_id": employee.id,
        "name": employee.name,
        "email": employee.email,
        "level": employee.level,
        "role": employee.role,
        "department": employee.department
    }

@router.post("/login", response_model=Token)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    normalized_email = request.email.strip().lower()
    user_cred = db.query(UserCredential).filter(UserCredential.email == normalized_email).first()
    if not user_cred or not verify_password(request.password, user_cred.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
        
    employee = db.query(Employee).filter(Employee.id == user_cred.employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Employee profile not found",
        )
        
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_cred.employee_id, "email": user_cred.email}, 
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "employee_id": employee.id,
            "name": employee.name,
            "email": employee.email,
            "level": employee.level,
            "role": employee.role,
            "department": employee.department
        }
    }

from fastapi.security import OAuth2PasswordBearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user_dep(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    return get_current_user(token, db)

@router.get("/me")
def read_users_me(current_user: dict = Depends(get_current_user_dep)):
    return current_user
