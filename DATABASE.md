# Sandy Connect Database Design

This document explains the current local database design for Sandy Connect. It is intended for development discussion with the team and for explaining the backend data flow to stakeholders.

## Summary

Sandy Connect currently uses one local SQLite database:

```text
backend/sandy_connect.db
```

The database stores:

- employee directory data
- login credentials
- employee expertise profiles
- responsibility/knowledge topics
- Sandy bot chat history
- recommendations
- direct messages between employees
- contact request records
- recommendation feedback
- lightweight notification/audit records

For this project stage, one database is simpler and safer than two separate SQLite database files. SQLite cannot reliably enforce foreign keys across separate database files in the way we would want for app integrity. Keeping auth and app data in one database lets us link everything through `employees.id`.

## Core Identity Rule

The central identifier is:

```text
employees.id
```

Example:

```text
E002
```

This ID links login, profile data, chat history, direct messages, recommendations, and feedback.

The frontend never decides who the user is. After login, the backend reads the authenticated user's `employee_id` from the JWT token and uses that ID for all protected data access.

## Relationship Overview

```text
employees
  |
  |-- credentials
  |-- employee_profiles
  |-- chat_messages
  |-- direct_messages.sender_id
  |-- direct_messages.receiver_id
  |-- recommendations.recommended_employee_id
  |-- contact_requests.requester_employee_id
  |-- contact_requests.recommended_employee_id
  |-- outgoing_notifications.recipient_employee_id

chat_messages
  |
  |-- recommendations
        |
        |-- contact_requests
        |-- recommendation_feedback

contact_requests
  |
  |-- direct_messages
  |-- outgoing_notifications
```

## Tables

### `employees`

The main company directory table.

Key fields:

- `id`: stable employee ID, for example `E002`
- `name`
- `email`
- `level`
- `role`
- `department`
- `business_unit`
- `manager_id`: optional self-reference to another employee
- `location`

Important relationships:

- `manager_id -> employees.id`
- Used as the parent identity for most other tables.

### `credentials`

Stores login credentials for an employee.

Key fields:

- `employee_id`: primary key and foreign key to `employees.id`
- `email`: unique login email
- `hashed_password`: bcrypt password hash

Important relationships:

- `employee_id -> employees.id`

Notes:

- Plain-text passwords are never stored.
- Seed/demo users currently use the default password `Password123!`.
- JWTs use `employee_id` as the token subject.

### `employee_profiles`

Stores searchable skills and expertise for each employee.

Key fields:

- `employee_id`
- `skills_json`
- `expertise_topics_json`
- `projects_json`
- `notes`
- `confidence_score`
- `last_updated`

Important relationships:

- `employee_id -> employees.id`

Notes:

- JSON text fields are used for simple local development.
- This can later be normalized or backed by embeddings/PageIndex if needed.

### `responsibility_topics`

Stores approved internal responsibility areas and knowledge snippets.

Key fields:

- `topic`
- `keywords_json`
- `primary_contact_id`
- `backup_contact_id`
- `knowledge_summary`
- `source`

Important relationships:

- `primary_contact_id -> employees.id`
- `backup_contact_id -> employees.id`

Usage:

- Helps Sandy ground answers and avoid inventing company facts.
- Provides deterministic contact candidates before LLM answer formatting.

### `chat_messages`

Stores Sandy bot interactions, not employee-to-employee direct messages.

Key fields:

- `session_id`: frontend chat session ID
- `user_id`: logged-in employee ID
- `user_name`
- `user_level`
- `user_role`
- `user_department`
- `message`
- `bot_response`
- `detected_topic`
- `created_at`

Important relationships:

- `user_id -> employees.id`

Confidentiality rule:

- Bot history is queried by `user_id + session_id`.
- Another employee cannot read a user's Sandy bot history just by knowing the session ID.

### `recommendations`

Stores Sandy's recommended contacts for a bot message.

Key fields:

- `chat_message_id`
- `recommended_employee_id`
- `rank`
- `score`
- `reason`
- `recommendation_type`
- `created_at`

Important relationships:

- `chat_message_id -> chat_messages.id`
- `recommended_employee_id -> employees.id`

Usage:

- Preserves why someone was recommended.
- Allows later feedback to improve future scoring.

### `direct_messages`

Stores employee-to-employee chat messages.

Key fields:

- `sender_id`
- `receiver_id`
- `message`
- `read`
- `timestamp`

Important relationships:

- `sender_id -> employees.id`
- `receiver_id -> employees.id`

Confidentiality rule:

- A direct conversation is only returned if the logged-in user is either the sender or receiver.
- Unread counts are scoped to the logged-in receiver.

### `contact_requests`

Stores the ticket-like record created when a user confirms a Sandy recommendation.

Key fields:

- `recommendation_id`
- `chat_message_id`
- `requester_employee_id`
- `requester_name`
- `requester_level`
- `requester_role`
- `requester_department`
- `requester_message`
- `topic`
- `recommended_employee_id`
- `status`
- `notification_channel`
- `notification_message`
- `direct_message_id`
- `notified_at`
- `fulfilled_at`
- `created_at`
- `updated_at`

Important relationships:

- `recommendation_id -> recommendations.id`
- `chat_message_id -> chat_messages.id`
- `requester_employee_id -> employees.id`
- `recommended_employee_id -> employees.id`
- `direct_message_id -> direct_messages.id`

Usage:

- Links a recommendation to the actual direct message created for the recommended employee.
- Tracks whether the request has been fulfilled.

Confidentiality rule:

- Only the requester or recommended employee can access or update the contact request lifecycle.

### `outgoing_notifications`

Stores a lightweight notification/audit record for contact request delivery.

Key fields:

- `contact_request_id`
- `recipient_employee_id`
- `channel`
- `subject`
- `body`
- `status`
- `sent_at`
- `read_at`
- `created_at`

Important relationships:

- `contact_request_id -> contact_requests.id`
- `recipient_employee_id -> employees.id`

Notes:

- The current delivery channel is `chat`.
- This table is not an SMTP email system. It supports the notification panel and audit trail.

### `recommendation_feedback`

Stores feedback on recommendations after a contact request has been tried.

Key fields:

- `recommendation_id`
- `was_useful`
- `rating`
- `correct_employee_name`
- `feedback_text`
- `created_at`

Important relationships:

- `recommendation_id -> recommendations.id`

Confidentiality rule:

- Feedback is accepted from the requester who owns the recommendation/contact request.

Usage:

- Feedback is topic-aware.
- Negative feedback on an Azure recommendation should not automatically reduce an employee's AWS recommendation score.

## Main Application Flows

### 1. Credential Provisioning

1. Employee records are created or seeded in `employees`.
2. A credential row is created in `credentials` for each allowed employee.
3. The password is stored as a bcrypt hash.
4. The employee can then log in with email and password.

There is no public self-signup route in the current app. For local demos, credentials are auto-seeded with the default password `Password123!` when the database is empty.

Tables used:

- `employees`
- `credentials`

### 2. Login

1. User enters email and password.
2. Backend finds the matching row in `credentials`.
3. Backend verifies the bcrypt hash.
4. Backend loads employee profile from `employees`.
5. Backend returns a JWT token with `employee_id` as the subject.

Tables used:

- `credentials`
- `employees`

### 3. Asking Sandy

1. User sends a message to Sandy.
2. Backend ignores any client-supplied user identity fields and uses the JWT identity.
3. Request analyser classifies the message.
4. Context builder finds employees, responsibility topics, hierarchy data, and feedback signals.
5. Recommendation engine scores contacts deterministically.
6. Answer generator formats a grounded response.
7. Backend stores the bot message and recommendations.

Tables used:

- `employees`
- `employee_profiles`
- `responsibility_topics`
- `chat_messages`
- `recommendations`
- `recommendation_feedback`

### 4. Confirming A Recommendation

1. User clicks "Send chat message" on a recommendation.
2. Backend checks the recommendation belongs to the logged-in user.
3. Backend creates a `contact_requests` row.
4. Backend creates a `direct_messages` row from the requester to the recommended employee.
5. Backend creates an `outgoing_notifications` audit row.
6. Backend returns a `feedback_available_at` timestamp set 2 minutes after notification.
7. Frontend waits until that timestamp, then shows the requester a feedback prompt.
8. If the user switches chats or reloads, `/api/chat/history` restores the recommendation card and pending feedback state from `recommendations`, `contact_requests`, and `recommendation_feedback`.

Tables used:

- `recommendations`
- `chat_messages`
- `contact_requests`
- `direct_messages`
- `outgoing_notifications`

### 5. Direct Messaging

1. User opens a colleague chat.
2. Backend returns messages where the logged-in employee is sender or receiver.
3. Messages from the colleague to the logged-in user are marked as read.
4. New messages are stored in `direct_messages`.

Tables used:

- `direct_messages`
- `employees`

### 6. Marking A Contact Request Fulfilled

1. Requester or recommended employee marks the request fulfilled.
2. Backend checks that the logged-in user is a participant.
3. Backend updates `contact_requests.status` and `fulfilled_at`.
4. Backend returns a feedback prompt.

Tables used:

- `contact_requests`
- `direct_messages`

### 7. Feedback

1. The delayed feedback prompt stays available until the user submits rating/usefulness/text feedback.
2. Backend checks that the feedback belongs to the requester/recommendation.
3. Backend stores the row in `recommendation_feedback`.
4. Future recommendations use this as a topic-aware scoring signal.

Tables used:

- `recommendation_feedback`
- `recommendations`
- `chat_messages`
- `contact_requests`

## Security And Confidentiality Rules

Current local security rules:

- Login is mandatory for app routes that access user or recommendation data.
- Public self-signup is disabled; users need an existing employee credential.
- Passwords are stored as bcrypt hashes.
- JWT token subject is the employee ID.
- Frontend-provided identity fields are ignored for authenticated Sandy requests.
- Sandy bot history is scoped by logged-in `user_id`.
- Direct messages are visible only to participants.
- Recommendation confirmation is allowed only for the requester who owns the recommendation.
- Contact request fulfillment is allowed only for the requester or recommended employee.
- Recommendation feedback is tied to the owning recommendation/contact request.

## Resetting The Local Demo Database

For local development, the database can be reset back to only the seeded employees, employee profiles, responsibility topics, and demo credentials.

Stop the backend server, then run:

```bash
cd backend
source .venv/bin/activate
python reset_database.py --yes
```

This clears:

- `chat_messages`
- `recommendations`
- `recommendation_feedback`
- `contact_requests`
- `direct_messages`
- `outgoing_notifications`

It then recreates the original seeded knowledge base and login credentials.

Development limitations:

- This is local SQLite, not a production auth system.
- Role-based admin authorization is not fully implemented yet.
- For production, use HTTPS, stronger secret management, token expiry/refresh policy, audit logging, and likely an external identity provider.

## Indexes

Indexes are included for common reads:

- `chat_messages(user_id, session_id, created_at)`
- `recommendations(chat_message_id, rank)`
- `contact_requests(recommended_employee_id, status)`
- `contact_requests(requester_employee_id, status)`
- `outgoing_notifications(recipient_employee_id, created_at)`
- `direct_messages(sender_id, receiver_id, timestamp)`
- `direct_messages(receiver_id, read)`

These keep the main chat and notification queries efficient for local/demo usage.

## Why One Database For Now

One SQLite database is the right current choice because:

- It keeps setup simple.
- Foreign keys can be enforced locally.
- The `employee_id` identity link is easy to reason about.
- There is less risk of auth data and employee data drifting apart.
- It is easier for the team to inspect and debug.

A future production version can split auth into a managed identity provider or a separate service. At that point, the app database would still keep `employee_id` or an external identity ID as the bridge.
