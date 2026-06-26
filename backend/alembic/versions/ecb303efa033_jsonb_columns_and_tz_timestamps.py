"""jsonb columns and tz timestamps

Revision ID: ecb303efa033
Revises: 41b6fa4779eb
Create Date: 2026-06-26 16:33:55.842735

Migrates the existing seeded Postgres DB in place:
  - JSON text columns (TEXT)  -> native JSONB, casting existing JSON strings via ::jsonb
  - timestamp columns (TIMESTAMP WITHOUT TIME ZONE) -> TIMESTAMP WITH TIME ZONE,
    interpreting existing naive values as UTC via "AT TIME ZONE 'UTC'"

Data is preserved (465 employees etc.). Safe to re-run only via alembic; not
idempotent at the SQL level.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'ecb303efa033'
down_revision: Union[str, Sequence[str], None] = '41b6fa4779eb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (table, column, nullable) for every timestamp column being converted.
_TIMESTAMP_COLUMNS = [
    ('chat_messages', 'created_at', False),
    ('contact_requests', 'notified_at', True),
    ('contact_requests', 'fulfilled_at', True),
    ('contact_requests', 'created_at', False),
    ('contact_requests', 'updated_at', False),
    ('direct_messages', 'timestamp', False),
    ('employee_profiles', 'last_updated', False),
    ('outgoing_notifications', 'created_at', False),
    ('outgoing_notifications', 'sent_at', True),
    ('outgoing_notifications', 'read_at', True),
    ('recommendation_feedback', 'created_at', False),
    ('recommendations', 'created_at', False),
]

# (table, column) for every JSON text column being converted to JSONB.
_JSON_COLUMNS = [
    ('employee_profiles', 'skills_json'),
    ('employee_profiles', 'expertise_topics_json'),
    ('employee_profiles', 'projects_json'),
    ('responsibility_topics', 'keywords_json'),
]


def upgrade() -> None:
    """Upgrade schema: TEXT->JSONB, TIMESTAMP WITHOUT TZ -> WITH TZ (as UTC)."""
    for table, col in _JSON_COLUMNS:
        op.alter_column(
            table, col,
            existing_type=sa.TEXT(),
            type_=postgresql.JSONB(astext_type=sa.Text()),
            existing_nullable=False,
            postgresql_using=f'{col}::jsonb',
        )

    for table, col, nullable in _TIMESTAMP_COLUMNS:
        op.alter_column(
            table, col,
            existing_type=postgresql.TIMESTAMP(),
            type_=sa.DateTime(timezone=True),
            existing_nullable=nullable,
            postgresql_using=f"{col} AT TIME ZONE 'UTC'",
        )


def downgrade() -> None:
    """Downgrade schema: WITH TZ -> WITHOUT TZ (UTC), JSONB -> TEXT."""
    for table, col, nullable in _TIMESTAMP_COLUMNS:
        op.alter_column(
            table, col,
            existing_type=sa.DateTime(timezone=True),
            type_=postgresql.TIMESTAMP(),
            existing_nullable=nullable,
            postgresql_using=f"{col} AT TIME ZONE 'UTC'",
        )

    for table, col in _JSON_COLUMNS:
        op.alter_column(
            table, col,
            existing_type=postgresql.JSONB(astext_type=sa.Text()),
            type_=sa.TEXT(),
            existing_nullable=False,
            postgresql_using=f'{col}::text',
        )