from __future__ import annotations

import json

from app.database import Employee, SessionLocal, init_db
from app.services.answer_generator import generate_answer
from app.services.context_builder import build_context
from app.services.recommendation_engine import recommend_contacts
from app.services.request_analyser import analyse_user_request
from app.services.seed_data import seed_database


EXAMPLE_MESSAGES = [
    {
        "user_name": "Aryan",
        "user_level": "L2",
        "user_role": "Programmer Analyst",
        "user_department": "Technology",
        "message": "Who works best for AWS?",
    },
    {
        "user_name": "Aryan",
        "user_level": "L2",
        "user_role": "Programmer Analyst",
        "user_department": "Technology",
        "message": "Who should I contact about upcoming expos?",
    },
    {
        "user_name": "Aryan",
        "user_level": "L2",
        "user_role": "Programmer Analyst",
        "user_department": "Technology",
        "message": "Who do I report to?",
    },
    {
        "user_name": "Harish",
        "user_level": "L8",
        "user_role": "Associate Manager",
        "user_department": "Technology",
        "message": "Who should I speak to about PageIndex?",
    },
    {
        "user_name": "Aryan",
        "user_level": "L2",
        "user_role": "Programmer Analyst",
        "user_department": "Technology",
        "message": "Who knows Kubernetes deployment pipelines?",
    },
    {
        "user_name": "Aryan",
        "user_level": "L2",
        "user_role": "Programmer Analyst",
        "user_department": "Technology",
        "message": "Hi Sandy",
    },
    {
        "user_name": "Aryan",
        "user_level": "L2",
        "user_role": "Programmer Analyst",
        "user_department": "Technology",
        "message": "Thanks",
    },
    {
        "user_name": "Aryan",
        "user_level": "L2",
        "user_role": "Programmer Analyst",
        "user_department": "Technology",
        "message": "Can you order pizza for me?",
    },
]


def _ensure_seeded(db) -> None:
    init_db()
    employee_count = db.query(Employee).count()
    if employee_count == 0:
        seed_database(db)


def main() -> None:
    db = SessionLocal()
    try:
        _ensure_seeded(db)
        for index, example in enumerate(EXAMPLE_MESSAGES, start=1):
            user_profile = {
                "user_name": example["user_name"],
                "user_level": example["user_level"],
                "user_role": example["user_role"],
                "user_department": example["user_department"],
            }

            analysis = analyse_user_request(example["message"], user_profile)
            context = build_context(db, analysis, example["message"], user_profile)
            recommendations = recommend_contacts(context)
            answer = generate_answer(example["message"], context, recommendations)

            print("=" * 80)
            print(f"Example {index}: {example['message']}")
            print("\nAnalysis:")
            print(json.dumps(analysis, indent=2))
            print("\nRecommendations:")
            print(json.dumps(recommendations, indent=2))
            print("\nFinal answer:")
            print(answer)
            print()
    finally:
        db.close()


if __name__ == "__main__":
    main()
