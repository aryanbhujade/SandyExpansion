import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
import bcrypt
from sqlalchemy.orm import Session

from app.database import Employee, UserCredential, get_db


# ---------------------------------------------------------------------------
# JWT secret & token lifetime (production hardening)
# ---------------------------------------------------------------------------
# The secret is resolved at import time:
#   1. SANDY_JWT_SECRET env var (preferred — stable across restarts).
#   2. In production (SANDY_ENV=production) the absence of a secret is fatal,
#      so we never silently fall back to a hardcoded default.
#   3. In development we generate an ephemeral secret and warn the operator
#      that sessions will not survive a restart.

def _resolve_jwt_secret() -> str:
    secret = os.getenv("SANDY_JWT_SECRET", "").strip()
    if secret:
        return secret

    env = os.getenv("SANDY_ENV", "development").strip().lower()
    if env == "production":
        raise RuntimeError(
            "SANDY_JWT_SECRET must be set when SANDY_ENV=production. "
            "Refusing to start with an insecure default secret."
        )

    ephemeral = secrets.token_urlsafe(48)
    print(
        "WARNING: SANDY_JWT_SECRET is not set. Generated an ephemeral secret — "
        "tokens will NOT survive a restart. Set SANDY_JWT_SECRET for stable sessions."
    )
    return ephemeral


SECRET_KEY = _resolve_jwt_secret()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("SANDY_ACCESS_TOKEN_MINUTES", str(60 * 24 * 7)))

# In-memory revoked-token registry (jti-based). Local/demo only: a server
# restart clears this set, which is acceptable for the current SQLite setup.
# A production deployment would back this with a persistent store (Redis, DB).
_revoked_jtis: set[str] = set()


def revoke_token(jti: str) -> None:
    if jti:
        _revoked_jtis.add(jti)


def is_token_revoked(jti: str | None) -> bool:
    return bool(jti) and jti in _revoked_jtis


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
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def _user_payload(user_cred: UserCredential, employee: Employee) -> dict:
    return {
        "employee_id": employee.id,
        "name": employee.name,
        "email": employee.email,
        "level": employee.level,
        "role": employee.role,
        "department": employee.department,
        "is_admin": bool(user_cred.is_admin),
    }


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({
        "exp": expire,
        "jti": secrets.token_urlsafe(16),
    })
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str, db: Session):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    jti = payload.get("jti")
    if is_token_revoked(jti):
        raise HTTPException(status_code=401, detail="Token has been revoked")

    employee_id: str = payload.get("sub")
    if employee_id is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_cred = db.query(UserCredential).filter(UserCredential.employee_id == employee_id).first()
    if user_cred is None:
        raise HTTPException(status_code=401, detail="User not found")

    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=401, detail="Employee details not found")

    return _user_payload(user_cred, employee)


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user_dep(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    return get_current_user(token, db)


def require_admin_dep(current_user: dict = Depends(get_current_user_dep)) -> dict:
    """FastAPI dependency that gates an endpoint to admin users only."""
    if not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges are required for this action.",
        )
    return current_user


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

    access_token = create_access_token(
        data={"sub": user_cred.employee_id, "email": user_cred.email}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": _user_payload(user_cred, employee),
    }


@router.post("/logout")
def logout(token: str = Depends(oauth2_scheme)):
    """Revoke the current access token (jti-based). Subsequent uses are rejected."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        # Already invalid/expired — nothing to revoke, treat as success.
        return {"status": "ok", "message": "Session already invalidated."}
    revoke_token(payload.get("jti", ""))
    return {"status": "ok", "message": "Logged out."}


@router.get("/me")
def read_users_me(current_user: dict = Depends(get_current_user_dep)):
    return current_user