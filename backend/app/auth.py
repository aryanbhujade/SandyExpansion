from datetime import datetime, timedelta, timezone
import os
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import bcrypt

from sqlalchemy.orm import Session
from app.auth_database import get_auth_db, UserCredential
from app.database import get_db, Employee

SECRET_KEY = os.getenv("SANDY_JWT_SECRET", "internbot-local-development-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=3, max_length=320)
    password: str = Field(..., min_length=8, max_length=72)

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

def get_current_user(token: str, auth_db: Session, main_db: Session):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        employee_id: str = payload.get("sub")
        if employee_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    user_cred = auth_db.query(UserCredential).filter(UserCredential.employee_id == employee_id).first()
    if user_cred is None:
        raise HTTPException(status_code=401, detail="User not found")
        
    employee = main_db.query(Employee).filter(Employee.id == employee_id).first()
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
def login(request: LoginRequest, auth_db: Session = Depends(get_auth_db), main_db: Session = Depends(get_db)):
    normalized_email = request.email.strip().lower()
    user_cred = auth_db.query(UserCredential).filter(UserCredential.email == normalized_email).first()
    if not user_cred or not verify_password(request.password, user_cred.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
        
    employee = main_db.query(Employee).filter(Employee.id == user_cred.employee_id).first()
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

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, auth_db: Session = Depends(get_auth_db), main_db: Session = Depends(get_db)):
    normalized_email = request.email.strip().lower()
    employee = main_db.query(Employee).filter(Employee.email == normalized_email).first()
    if not employee or employee.name.strip().casefold() != request.name.strip().casefold():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee profile matches that name and email.",
        )

    existing = auth_db.query(UserCredential).filter(
        (UserCredential.employee_id == employee.id) | (UserCredential.email == normalized_email)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already exists for this employee. Please sign in.",
        )

    hashed_password = bcrypt.hashpw(request.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    auth_db.add(UserCredential(employee_id=employee.id, email=normalized_email, hashed_password=hashed_password))
    auth_db.commit()

    access_token = create_access_token(
        data={"sub": employee.id, "email": employee.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
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
            "department": employee.department,
        },
    }

from fastapi.security import OAuth2PasswordBearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user_dep(token: str = Depends(oauth2_scheme), auth_db: Session = Depends(get_auth_db), main_db: Session = Depends(get_db)):
    return get_current_user(token, auth_db, main_db)

@router.get("/me")
def read_users_me(current_user: dict = Depends(get_current_user_dep)):
    return current_user
