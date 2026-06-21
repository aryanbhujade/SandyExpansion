import json
import os
import sys

# Ensure backend path is added so we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import bcrypt
from sqlalchemy.orm import Session

from app.auth_database import AuthSessionLocal, UserCredential, init_auth_db

def get_password_hash(password: str) -> str:
    # Hash password using bcrypt directly
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def main():
    print("Initializing auth database...")
    init_auth_db()
    
    seed_file = os.path.join("data", "seed_employees.json")
    if not os.path.exists(seed_file):
        print(f"Seed file not found at {seed_file}")
        return

    with open(seed_file, "r") as f:
        employees = json.load(f)

    db: Session = AuthSessionLocal()
    default_password = "Password123!"
    hashed_password = get_password_hash(default_password)
    
    print(f"Seeding credentials for {len(employees)} employees with default password: {default_password}")
    
    try:
        for emp in employees:
            existing_user = db.query(UserCredential).filter(UserCredential.employee_id == emp["id"]).first()
            if not existing_user:
                new_user = UserCredential(
                    employee_id=emp["id"],
                    email=emp["email"],
                    hashed_password=hashed_password
                )
                db.add(new_user)
        
        db.commit()
        print("Successfully seeded all credentials!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding credentials: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
