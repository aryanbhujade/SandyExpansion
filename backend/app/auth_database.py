import os

from sqlalchemy import Column, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

AUTH_DATABASE_URL = os.getenv("AUTH_DATABASE_URL", "sqlite:///./sandy_auth.db")

auth_engine = create_engine(AUTH_DATABASE_URL, connect_args={"check_same_thread": False})
AuthSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=auth_engine)
AuthBase = declarative_base()

class UserCredential(AuthBase):
    __tablename__ = "credentials"

    employee_id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

def init_auth_db():
    AuthBase.metadata.create_all(bind=auth_engine)

def get_auth_db():
    db = AuthSessionLocal()
    try:
        yield db
    finally:
        db.close()
