# Changes Made

## Current Database And Notification Direction

The current implementation uses one local SQLite database, `backend/sandy_connect.db`, for both authentication and Sandy Connect application data. The old separate `auth.db` / `auth_database.py` direction has been removed.

Public self-signup has also been removed. Demo credentials are seeded/admin-provisioned from existing employee records, and users only log in through `POST /api/auth/login`.

Recommendation confirmations now create an internal direct chat message for the recommended employee and store an audit row in `outgoing_notifications`. They do not send real SMTP email. See `DATABASE.md` for the current schema, relationships, and data-flow documentation.

## Fine-tuning Features (User Profile, Time-sorted DMs, Unread Badges, Notifications, and gitignore Cleanup)

A set of UI polish and fine-tuning improvements were implemented to support direct messaging workflow, user identity, and repository cleanup:

### 1. User Profile Modal & Identity Visibility
- **Frontend Changes:**
  - Created a glassmorphic user card pinned to the bottom of the sidebar displaying the logged-in user's name, avatar, and designation.
  - Added a "Profile" button opening a custom edit modal (`ProfileModal.tsx`) allowing users to view and update their department, role, location, skills, projects, and notes/bio.
  - Integrated `AuthContext` to trigger `refreshUser()` on successful update, immediately updating the card without page reloads.
- **Backend Changes:**
  - Added `GET /api/employees/{employee_id}/profile` to retrieve profile details (skills, expertise, projects, notes).
  - Added `PUT /api/employees/profile` to update user profile information.

### 2. Time-sorted DMs & Sidebar Badges
- **Frontend Changes:**
  - The DM sidebar list now dynamically sorts active threads based on the latest message timestamp in descending order (newest chats on top), falling back to alphabetical sorting for colleagues with no chat history.
  - Added count badges (green circles) displaying unread DMs next to each colleague's name.
  - Selecting a colleague clears their unread state instantly in the UI.
- **Backend Changes:**
  - Added `GET /api/messages/conversations/active` returning metadata of last active messages (message content, sender_id, read status, and timestamp).
  - Added `GET /api/messages/unread/count` returning unread count grouped by sender.
  - Modified `GET /api/messages/{employee_id}` to mark incoming messages from that colleague as read.
  - Added database migration on backend startup to introduce the `read` column to `direct_messages` schema.

### 3. Real-Time Floating DM Toasts
- **Frontend Changes:**
  - Set up a custom slide-in floating notification toast system at the bottom-right corner of the workspace.
  - Triggers a toast when a new direct message is received from a colleague other than the one currently active in the chat viewport.
  - Clicking the toast shifts focus to that DM and dismisses the notification.
  - Toasts auto-expire and slide out of view after 5 seconds.

### 4. Repository Cleanup & Running Instructions
- Deleted duplicate `.gitignore` files from `backend/` and `frontend/` folders.
- Created a consolidated `.gitignore` file at the repository root managing Node/Vite build directories, Python virtual environments, SQLite database files, environment variables, logs, and OS files.
- Overhauled `README.md` to document the new features, provide clear setup steps for LLM (Ollama/Mistral), backend, frontend, and list pre-seeded usernames and credentials for quick sign-in.

---

## FIGMA UI & INTEGRATION CHANGES (PREVIOUS WORK)

This file documents the changes made during the Figma-inspired chat UI update and the frontend-to-backend integration work for the root project folders:

- `frontend/`
- `backend/`

## Scope

Two main tasks were completed:

1. Redesign the frontend chat experience using the provided Figma direction.
2. Connect the frontend to the local FastAPI backend that uses local Ollama Mistral.

## Frontend Changes

### 1. Chat page redesign

File changed:

- `frontend/src/pages/ChatPage.tsx`

What changed:

- Replaced the previous single glass-panel chat layout with a darker ChatGPT-style shell inspired by the supplied Figma kit.
- Added a left sidebar with:
  - workspace branding
  - session status
  - recent prompts
  - quick capability summary
- Added a cleaner top header for the main chat area.
- Added a centered empty state with prompt suggestions.
- Restyled the message thread to look more like a modern AI client.
- Restyled recommendation cards so each recommendation is shown as a separate panel.
- Kept all existing behavior intact:
  - sending messages
  - showing typing state
  - rendering bot recommendations
  - confirm-notify workflow
  - clear chat
  - backend/demo mode badge

### 2. Backend availability check improvement

File changed:

- `frontend/src/services/api.ts`

What changed:

- Updated the frontend backend-availability probe from `GET /docs` to `GET /health`.

Why:

- `/health` is the proper lightweight health-check endpoint exposed by the backend.
- This is more reliable and intentional than probing Swagger docs.

### 3. Frontend local environment file

File added:

- `frontend/.env`

Values configured:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_DEFAULT_REQUESTER_ID=EMP0001
VITE_DEFAULT_REQUESTER_NAME=Aryan
```

Purpose:

- Point the React app at the local FastAPI backend.
- Set a default requester identity until auth exists.

## Backend Changes

### 1. Backend local environment file

File added:

- `backend/.env`

Values configured:

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
DATABASE_URL=sqlite:///./sandy_connect.db
SANDY_TEST_NOTIFICATION_EMAIL=aryan.bhujade@sandhata.com
```

Purpose:

- Connect the backend to local Ollama.
- Use the local SQLite database in `backend/sandy_connect.db`.
- Keep mocked notification delivery target configured.

### 2. Backend runtime setup

Operational setup completed:

- Created a Python virtual environment in `backend/.venv`
- Installed backend dependencies from `backend/requirements.txt`

Installed package group includes:

- `fastapi`
- `uvicorn`
- `pydantic`
- `requests`
- `python-dotenv`
- `sqlalchemy`

### 3. Database seeding

Operational setup completed:

- Seeded the SQLite database using:

```bash
python -m app.services.seed_data
```

Result:

- 15 employees seeded
- 15 employee profiles seeded
- 9 responsibility topics seeded

## Integration Verification

The following flows were verified successfully against the real backend and local Ollama:

### 1. Ollama connectivity

Verified:

- Local Ollama was reachable at `http://127.0.0.1:11434`
- Installed model present:
  - `mistral:latest`

### 2. Backend health

Verified:

- `GET /health` returns success

### 3. Frontend chat endpoint compatibility

Verified:

- `POST /api/chat` returns the shape expected by the frontend:
  - `message`
  - `domain`
  - `recommendations`
  - `session_id`
  - `confirmation_required`
  - `confirmation_prompt`

### 4. Recommendation confirmation flow

Verified:

- `POST /recommendations/{recommendation_id}/confirm` works
- Mock notification payload is returned correctly

### 5. Frontend production build

Verified:

- `npm run build` completes successfully

## Files Added

- `backend/.env`
- `frontend/.env`
- `changes.md`

## Files Modified

- `frontend/src/pages/ChatPage.tsx`
- `frontend/src/services/api.ts`

## Operational Steps Performed

These were performed locally during integration but are not source-code changes:

- Created `backend/.venv`
- Installed backend dependencies
- Seeded the database
- Ran the FastAPI server locally on port `8000`
- Tested live requests against Ollama and the backend

## Known Remaining Issue

There is one pre-existing frontend build warning that was not changed as part of the integration:

- `frontend/index.html` references `/src/style.css`
- that file does not exist at build time

This does not currently block the app, but it should be cleaned up separately.

## Teammate Setup And Run Instructions

This section is meant to be enough for a teammate to clone the repo, install dependencies, and run the project locally.

### Prerequisites

Make sure the machine has:

- Python 3.11 or newer
- Node.js 20 or newer
- npm
- Ollama installed locally

### Project folders to use

Use the root project folders:

- `backend/`
- `frontend/`

Do not use the duplicate `SandyExpansion/backend` and `SandyExpansion/frontend` folders for this setup.

### 1. Start Ollama

Start Ollama in one terminal:

```bash
ollama serve
```

If the model is not already installed:

```bash
ollama pull mistral
```

Optional check:

```bash
ollama list
```

Expected model:

- `mistral:latest`

### 2. First-time backend setup

From the repo root:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Then ensure `backend/.env` contains:

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
DATABASE_URL=sqlite:///./sandy_connect.db
SANDY_TEST_NOTIFICATION_EMAIL=aryan.bhujade@sandhata.com
```

### 3. Seed the backend database

Run:

```bash
cd backend
.venv/bin/python -m app.services.seed_data
```

Expected result:

- local SQLite database created at `backend/sandy_connect.db`
- seed data inserted for employees, employee profiles, and responsibility topics

### 4. Start the backend

Run:

```bash
cd backend
.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If you get `Address already in use`, something is already using port `8000`.

Check:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
```

Then stop the old process using its PID:

```bash
kill <PID>
```

### 5. First-time frontend setup

Open a new terminal and run:

```bash
cd frontend
npm install
cp .env.example .env
```

Then ensure `frontend/.env` contains:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_DEFAULT_REQUESTER_ID=EMP0001
VITE_DEFAULT_REQUESTER_NAME=Aryan
```

### 6. Start the frontend

Run:

```bash
cd frontend
npm run dev
```

Expected local URL:

- `http://localhost:5173`

### 7. Verify the app

Open:

- `http://localhost:5173`

What to check:

- the chat page shows `API connected`
- sending a message returns real recommendations
- clicking `Notify contact` works on the recommendation cards

Recommended test queries:

- `Who works best for AWS?`
- `Who can help me with Azure DevOps access?`
- `Who owns Zoho access requests?`
- `Who can help with legacy modernisation for a banking client?`

### 8. Optional API-level verification

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Chat test:

```bash
curl -X POST http://127.0.0.1:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Who works best for AWS?",
    "requester_id": "EMP0001",
    "session_id": "manual-test-session"
  }'
```

Recommendation confirm test:

```bash
curl -X POST http://127.0.0.1:8000/recommendations/1/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "requester_name": "Aryan",
    "notification_channel": "email"
  }'
```

### 9. Build check

Frontend production build:

```bash
cd frontend
npm run build
```

Backend does not currently have a separate build step; it is run directly with Uvicorn.

### 10. Notes for teammate

- Notifications are mocked by the backend right now. The app stores the outgoing notification record but does not send real email.
- Ollama must be running before testing chat requests.
- The frontend falls back to demo mode if the backend is unavailable.
- The backend uses SQLite locally, so no separate database server is required.

## Suggested Next Cleanup

If desired, the next small follow-up would be:

1. Remove the stale `/src/style.css` reference from `frontend/index.html`
2. Optionally document local run steps in the root README for this exact repo layout

---

## Phase 2 — Authentication, Notifications, 1:1 Messaging & Chat Persistence

Date: 2026-06-21

### Scope

This phase adds a full authentication system, in-app notification UI, direct 1:1 messaging between employees, employee directory API with filters, and chat history persistence.

---

### Backend — New Files

#### `backend/app/auth.py`

- JWT-based authentication system using `PyJWT` and `bcrypt`
- Endpoints:
  - `POST /api/auth/login` — email/password login, returns JWT + user profile
  - `POST /api/auth/register` — register using existing employee profile, returns JWT
  - `GET /api/auth/me` — returns current authenticated user from token
- `get_current_user_dep` dependency used across all protected endpoints
- Tokens expire after 7 days

#### `backend/app/auth_database.py`

- Separate SQLite database (`auth.db`) for user credentials
- `UserCredential` model with `employee_id`, `email`, and `hashed_password`

#### `backend/app/employees.py`

- `GET /api/employees` — list employees with optional filters:
  - `department`, `level`, `business_unit`, `location`, `search` (name)
  - Pagination via `page` and `limit`
- `GET /api/employees/{employee_id}` — single employee lookup

#### `backend/app/messages.py`

- `GET /api/messages/{employee_id}` — fetch direct messages between current user and target employee
- `POST /api/messages/{employee_id}` — send a direct message
- Self-messaging is blocked with a `400` error
- Messages stored in `DirectMessage` table with sender, receiver, content, and timestamp

#### `backend/app/notifications.py`

- `GET /api/notifications` — fetch all notifications for the authenticated user
- `PUT /api/notifications/{id}/read` — mark a notification as read (sets `read_at` timestamp)
- Maps `OutgoingNotification` records to frontend-expected JSON shape

#### `backend/seed_auth.py`

- Seeds authentication credentials for all 15 employees
- Default password for all accounts: `Password123!`

### Backend — Modified Files

#### `backend/app/database.py`

- Added `session_id` column to `ChatMessage`
- Added `read_at` column to `OutgoingNotification`
- Added `DirectMessage` model for 1:1 messaging

#### `backend/app/main.py`

- Registered `auth_router`, `messages_router`, `employees_router`, `notifications_router`
- Updated `POST /api/chat` to use JWT auth (`get_current_user_dep`)
- Added `GET /api/chat/history` endpoint to fetch chat messages by `session_id`
- `FrontendChatRequest` uses authenticated user profile instead of hardcoded requester

#### `backend/requirements.txt`

- Added `PyJWT`, `bcrypt`, `python-multipart` dependencies

---

### Frontend — New Files

#### `frontend/src/context/AuthContext.tsx`

- React context for authentication state
- Stores user object and JWT token in `localStorage`
- `useAuth()` hook provides `user`, `login`, `logout`, `loading`
- Auto-restores session from stored token on mount via `GET /api/auth/me`

#### `frontend/src/pages/SignInPage.tsx`

- Email/password sign-in form
- Calls `POST /api/auth/login`
- Redirects to `/chat` on success

#### `frontend/src/pages/SignUpPage.tsx`

- Registration form (name, email, password)
- Validates against existing employee profiles
- Calls `POST /api/auth/register`

#### `frontend/src/pages/HierarchyPage.tsx`

- Employee directory/hierarchy browsing page

### Frontend — Modified Files

#### `frontend/src/pages/ChatPage.tsx`

Major update with the following additions:

- **Notification bell icon** in the header with unread count badge
- **Notification slide-out panel** (right side) with:
  - Topic, requester, channel, relative timestamp per notification
  - "Mark read" button for unread notifications
  - Animated entrance/exit via `AnimatePresence`
  - Empty state when no notifications exist
- **Notification auto-polling** every 30 seconds
- **Sidebar self-exclusion** — logged-in user is filtered out of the Direct Messages list
- **Dynamic header** — shows "Chat with {Name}" and recipient's role when in DM mode
- **DM auto-polling** — fetches new messages every 5 seconds in DM conversations
- **Context-aware input placeholder** — "Message {name}..." in DM mode vs bot prompt in AI mode
- **Proper sender initials** — shows first letter of name in DM avatars
- **Context-aware footer** — different help text for bot mode vs DM mode

#### `frontend/src/context/ChatContext.tsx`

- `sessionId` now **persisted in `localStorage`** under `internbot_session_id`
- On mount, restores previous chat history from `GET /api/chat/history`
- `clearChat()` generates a new session and persists it

#### `frontend/src/services/api.ts`

- Added `authApi` with `login`, `getMe`, and `register` methods
- Added `notificationApi` with `list` and `markRead` methods
- Added `messageApi` with `getMessages` and `sendMessage` methods
- Added JWT token interceptor to Axios instance

#### `frontend/src/types/index.ts`

- Added `Notification` type
- Added `ConfirmRecommendationResponse` type
- Added `EmployeeFilters` type

#### `frontend/src/App.tsx`

- Added `AuthProvider` wrapper
- Added `ProtectedRoute` component for auth-guarded pages
- Added routes: `/signin`, `/signup`, `/hierarchy`

#### `frontend/src/components/ui/splite.tsx`

- Removed `React.lazy()` and `Suspense` wrapper from Spline 3D component
- Direct import for reliable rendering

#### `frontend/src/pages/LandingPage.tsx`

- Changed Card container from `min-h-screen` to `h-screen` to fix Spline 3D rendering (child flex height calculation)

---

### Root — New Files

#### `.gitignore`

- Excludes: `node_modules/`, `.venv/`, `__pycache__/`, `*.db`, `.env`, `dist/`, `.vscode/`, `.DS_Store`, logs, `.gemini/`

#### `mock_user_credentials.md`

- Reference table of all 15 seeded test accounts with email/password

---

### Files Added (Phase 2)

- `backend/app/auth.py`
- `backend/app/auth_database.py`
- `backend/app/employees.py`
- `backend/app/messages.py`
- `backend/app/notifications.py`
- `backend/seed_auth.py`
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/pages/SignInPage.tsx`
- `frontend/src/pages/SignUpPage.tsx`
- `frontend/src/pages/HierarchyPage.tsx`
- `.gitignore`
- `mock_user_credentials.md`

### Files Modified (Phase 2)

- `backend/app/database.py`
- `backend/app/main.py`
- `backend/requirements.txt`
- `frontend/src/pages/ChatPage.tsx`
- `frontend/src/context/ChatContext.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/types/index.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/ui/splite.tsx`
- `frontend/src/pages/LandingPage.tsx`

---

### Verification (Phase 2)

- `npm run build` — 0 TypeScript errors, production build succeeds
- Login flow verified via API (`POST /api/auth/login`)
- Employee list verified — returns `E001`–`E015` with correct fields
- Sidebar self-exclusion verified — logged-in user does not appear
- Notification fetch/read verified — `GET /api/notifications`, `PUT /api/notifications/{id}/read`
- DM send/receive verified — `POST /api/messages/{id}`, `GET /api/messages/{id}`
- Chat history restore verified — `GET /api/chat/history?session_id=...`

### Teammate Setup Additions (Phase 2)

After completing the setup from Phase 1 above, also run:

```bash
cd backend
.venv/bin/python seed_auth.py
```

This seeds login credentials for all 15 employees. See `mock_user_credentials.md` for the full list.

All test accounts use the password: `Password123!`

---

## Phase 3 — Analytics CRUD, RBAC Admin & Production Auth Hardening

Date: 2026-06-24

### Scope

Adds an admin-only analytics/dashboard layer, role-based access control (RBAC) for
admin endpoints, and production authentication hardening. This closes two of the
gaps called out in the root `IMPLEMENTATION_STATUS.md`:

- "Analytics CRUD — REST analytics endpoints — Missing"
- "RBAC admin / prod auth hardening — Not implemented"

### Authorization model

An **admin is a normal user, not a separate account system.**

- The existing `employees` + `credentials` tables and `POST /api/auth/login` are reused. There is no separate admin table or login.
- A new `is_admin` boolean column was added to `credentials`, kept separate from `Employee.role` (the job title).
- `is_admin` is included in the JWT claims and the `/api/auth/me` response.
- A `require_admin_dep` FastAPI dependency gates admin-only endpoints (returns `403`).
- On startup, `_ensure_admin_credential` promotes the credential matching `SANDY_ADMIN_EMAIL` (default `dev.malhotra@example.com`, the seeded CTO). Same password as everyone else (`Password123!`).
- The frontend exposes `user.is_admin`; an `AdminRoute` guard plus an admin-only nav entry show the analytics workspace only to admins.

Rejected alternatives: deriving admin from `level >= L16` (fragile, couples auth to job titles), and a separate `admins` table + login (duplicates auth, breaks the "one identity = `employees.id`" rule documented in `DATABASE.md`).

### Backend — New Files

#### `backend/app/analytics.py`

Admin-only (`require_admin_dep`) analytics router mounted at `/api/analytics`:

- `GET /api/analytics/summary` — totals (employees, active users, chat messages, recommendations, confirmed, fulfilled, feedback, direct messages, notifications, unread), average rating + useful %, top requested topics, recommendations by department.
- `GET /api/analytics/recommendations?page=&limit=` — recommendations with requester, recommended employee, topic, score, contact-request status, and feedback.
- `GET /api/analytics/feedback?page=&limit=` — submitted feedback joined to topic and recommended employee.
- `GET /api/analytics/chat-messages?page=&limit=` — Sandy bot chat log with recommendation count per message.
- `DELETE /api/analytics/chat-messages/{id}` — admin moderation: deletes a chat message and its recommendations, contact requests, outgoing notifications, and feedback. Employee direct messages are intentionally left intact.
- `DELETE /api/analytics/feedback/{id}` — admin moderation: deletes a single feedback entry.

### Backend — Modified Files

#### `backend/app/database.py`

- Added `is_admin` boolean column to `UserCredential` (default `False`, server default `"0"`).
- Added SQLite migration `_ensure_sqlite_column("credentials", "is_admin", "BOOLEAN DEFAULT 0")` to existing `_ensure_local_schema_updates`, so existing local databases are upgraded on startup.

#### `backend/app/auth.py`

Production auth hardening + RBAC:

- JWT secret resolved from `SANDY_JWT_SECRET`. In `SANDY_ENV=production` the absence of a secret is **fatal** (refuses to start with an insecure default). In development an ephemeral secret is generated with a warning.
- Access token lifetime configurable via `SANDY_ACCESS_TOKEN_MINUTES` (default `10080` = 7 days).
- Tokens now carry a `jti`; an in-memory revoked-token set powers `POST /api/auth/logout` (jti-based revocation). Restart clears the set (acceptable for the local SQLite setup; a production deployment would back this with a persistent store).
- `is_admin` included in the login user payload, the `/api/auth/me` response, and the user dict returned by `get_current_user_dep`.
- New `require_admin_dep` dependency (403 if not admin).
- New `POST /api/auth/logout` endpoint.
- `ExpiredSignatureError` now returns a distinct 401 ("Token expired").

#### `backend/app/main.py`

- Registered `analytics_router` at `/api/analytics`.
- `/admin/seed` now requires `require_admin_dep` (was only `get_current_user_dep`).
- New startup helper `_ensure_admin_credential(db)` promotes the configured admin on every startup, and is called after credential seeding in `on_startup`.

#### `backend/seed_auth.py`

- Marks the credential matching `SANDY_ADMIN_EMAIL` as admin during seeding (new and existing rows).

#### `backend/.env.example` / `backend/.env`

Added auth hardening variables:

```env
SANDY_ENV=development
SANDY_JWT_SECRET=change-me-for-local-development
SANDY_ACCESS_TOKEN_MINUTES=10080
SANDY_ADMIN_EMAIL=dev.malhotra@example.com
```

### Frontend — New Files

#### `frontend/src/pages/AnalyticsPage.tsx`

Admin-only analytics dashboard at `/analytics`. Matches the existing glassmorphic dark UI (same `bg-[#0b0b0c]`, emerald accents, `Card`/`Button` components, Framer Motion) as the hierarchy and sign-in pages. Renders:

- Summary metric cards (employees, active users, chat messages, recommendations, confirmed, fulfilled, feedback, direct messages).
- Average rating + useful-percentage highlight, and top requested topics.
- Tabbed tables: Recommendations, Feedback, Chat Log — each with pagination.
- Admin moderation delete actions on the Feedback and Chat Log tables.

### Frontend — Modified Files

#### `frontend/src/App.tsx`

- Added `AdminRoute` (redirects non-admins to `/chat`).
- Added `/analytics` route guarded by `AdminRoute`.

#### `frontend/src/context/AuthContext.tsx`

- `User` interface now includes optional `is_admin`.
- `logout()` now calls `POST /api/auth/logout` (best-effort revocation) before clearing the client-side token.

#### `frontend/src/services/api.ts`

- `authApi.logout()` added.
- New `analyticsApi` (getSummary, getRecommendations, getFeedback, getChatMessages, deleteChatMessage, deleteFeedback).

#### `frontend/src/types/index.ts`

- Added `AnalyticsSummary`, `AnalyticsRecommendation`, `AnalyticsFeedback`, `AnalyticsChatMessage`, and `Paginated<T>` types.

#### `frontend/src/pages/ChatPage.tsx`

- Added an admin-only emerald "Analytics & Admin" icon button in the chat header (next to the notification bell) so the dashboard is reachable after login, not only from the landing page.

#### `frontend/src/pages/LandingPage.tsx`

- Added an admin-only "Analytics & Admin" CTA button in the landing page actions row.

### Setup changes vs. previous phases

The run steps are unchanged, but the backend now reads additional environment variables (all optional with sensible defaults, included in `backend/.env.example`):

- `SANDY_ENV` — `development` (default) or `production`.
- `SANDY_JWT_SECRET` — JWT signing secret. **Required when `SANDY_ENV=production`.**
- `SANDY_ACCESS_TOKEN_MINUTES` — access token lifetime (default `10080` = 7 days).
- `SANDY_ADMIN_EMAIL` — credential promoted to admin on startup (default `dev.malhotra@example.com`).

To try the new admin/analytics features after pulling:

1. Restart the backend so the startup migration + admin promotion run (look for `Promoted dev.malhotra@example.com to admin.` in the logs).
2. Log in as `dev.malhotra@example.com` / `Password123!` (the admin claim is baked into the JWT at login, so a fresh login is required).
3. Open the Analytics button in the chat header (or the landing page CTA).

### Verification

- `python -c "import app.main"` — backend imports clean; OpenAPI exposes `/api/analytics/*`, `/api/auth/logout`, and admin-gated `/admin/seed`.
- `npm run build` — 0 TypeScript errors, production build succeeds.
- Existing local databases are auto-migrated (the `is_admin` column is added on startup), so no manual reset is required. If the admin-promotion log line is missing on an older DB, run `python reset_database.py --yes` and restart.

### Files Added (Phase 3)

- `backend/app/analytics.py`
- `frontend/src/pages/AnalyticsPage.tsx`

### Files Modified (Phase 3)

- `backend/app/database.py`
- `backend/app/auth.py`
- `backend/app/main.py`
- `backend/seed_auth.py`
- `backend/.env.example`
- `backend/.env`
- `frontend/src/App.tsx`
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/types/index.ts`
- `frontend/src/pages/ChatPage.tsx`
- `frontend/src/pages/LandingPage.tsx`

### Repo cleanup

- Untracked the previously-committed `.DS_Store` (already covered by `.gitignore` going forward).
- Reverted an accidental trailing-newline change in `frontend/tsconfig.app.json`.

---

## Phase 4 — Cloud LLM (Ollama Cloud via the `ollama` Python SDK)

Date: 2026-06-25

### Scope

Replaces the local Ollama integration (Mistral over raw HTTP via `requests`) with
**Ollama Cloud** using the official `ollama` Python SDK and a cloud-routed model
(`glm-5.2:cloud`). The backend no longer requires a locally running Ollama daemon
to answer chat requests — it calls Ollama Cloud, authenticated by
`OLLAMA_API_KEY`. This is the change set staged on the `mk-2-cloud-llm` branch.

### What changed and why

- **Local Ollama → Ollama Cloud.** The previous implementation hit
  `POST http://localhost:11434/api/generate` with `requests` and required
  `ollama serve` + `ollama pull mistral` running on the machine. The new
  implementation uses the `ollama` SDK's `Client.chat(...)`, which routes
  `:cloud`-suffixed models to Ollama Cloud automatically when `OLLAMA_API_KEY`
  is set. No local model download or daemon is needed.
- **Auth handled by the SDK.** The `ollama` SDK reads `OLLAMA_API_KEY` from the
  environment and injects it as a `Bearer` header, so the code only passes
  `host` to the client (and only when `OLLAMA_BASE_URL` is set).
- **Secrets stay local.** `OLLAMA_API_KEY` lives only in the gitignored
  `backend/.env`. The tracked `backend/.env.example` keeps `OLLAMA_API_KEY=`
  empty.

### Backend — Modified Files

#### `backend/app/services/local_llm.py`

Rewritten to use the `ollama` SDK:

- `import ollama` replaces `import requests`.
- New `_build_client()` returns an `ollama.Client`, passing `host` only when
  `OLLAMA_BASE_URL` is set.
- `get_llm_settings()` now returns `dict[str, str | None]` with `model`, `host`
  (from `OLLAMA_BASE_URL`, optional), and `api_key` (from `OLLAMA_API_KEY`,
  optional). Default `OLLAMA_MODEL` is now `glm-5.2:cloud`.
- `generate_text()` now:
  - builds messages as a chat transcript (`system` + `user` roles) instead of a
    single `prompt` + `system` payload,
  - guards against an unset model with `LocalLLMError("OLLAMA_MODEL is not
    configured.")` (also narrows the type so the SDK overload matches),
  - calls `client.chat(model=..., messages=...)`,
  - parses `response["message"]["content"]` and strips it.
- Error handling wraps the SDK's generic `Exception` into `LocalLLMError`.

Callers are unchanged: `answer_generator.py` and `request_analyser.py` still call
`generate_text(prompt, system_prompt=...)`; `main.py` still imports
`get_llm_settings`. Both callers catch `LocalLLMError` and fall back to the
keyword/heuristic path (`_fallback_answer` / `_fallback_topic`), so a missing or
invalid key degrades gracefully instead of 500-ing every chat request.

#### `backend/requirements.txt`

- Added `ollama` (the official Ollama Python SDK). `requests` is no longer used
  by the LLM path but remains a dependency.

#### `backend/.env.example` / `backend/.env`

```env
# LLM endpoint (Ollama Cloud via the `ollama` Python SDK)
OLLAMA_BASE_URL=
OLLAMA_MODEL=glm-5.2:cloud
OLLAMA_API_KEY=
```

- `OLLAMA_MODEL` default changed from `mistral` → `glm-5.2:cloud`.
- `OLLAMA_API_KEY` added (empty in the tracked template; real value only in the
  gitignored `backend/.env`).
- `OLLAMA_BASE_URL` left blank — the SDK auto-routes `:cloud` models to Ollama
  Cloud. Set it only when targeting a non-default host.

### Running the cloud LLM version

Prerequisites change: **Ollama no longer needs to be installed or running
locally.** You only need a valid Ollama Cloud API key.

1. Install backend deps (now includes `ollama`):

   ```bash
   cd backend
   .venv/bin/pip install -r requirements.txt
   ```

2. Configure `backend/.env` (copy the template, then fill in your key):

   ```bash
   cp .env.example .env
   ```

   Set at minimum:

   ```env
   OLLAMA_MODEL=glm-5.2:cloud
   OLLAMA_API_KEY=<your Ollama Cloud API key>
   ```

   Leave `OLLAMA_BASE_URL` blank for Ollama Cloud.

3. Seed the DB (first run only) and start the backend:

   ```bash
   cd backend
   .venv/bin/python -m app.services.seed_data
   .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

   If port 8000 is taken, find and stop the listener:

   ```bash
   lsof -nP -iTCP:8000 -sTCP:LISTEN
   kill <PID>
   ```

4. Start the frontend (unchanged from previous phases):

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   Open `http://localhost:5173`.

5. Verify the chat path is hitting Ollama Cloud:

   ```bash
   curl -X POST http://127.0.0.1:8000/api/chat \
     -H "Content-Type: application/json" \
     -d '{
       "message": "Who works best for AWS?",
       "requester_id": "EMP0001",
       "session_id": "cloud-test"
     }'
   ```

   A real response (not the keyword fallback) confirms the cloud model is wired
   up. If `OLLAMA_API_KEY` is missing or invalid the backend raises
   `LocalLLMError("Ollama chat request failed: ...")`; check `backend/.env`.

### Files Added (Phase 4)

- `backend/pyproject.toml` — Pyrefly config pointing the type-checker at the
  project venv (`python-interpreter-path = ".venv/bin/python"`) so installed
  deps like `ollama` resolve. Tooling-only; no runtime effect.

### Files Modified (Phase 4)

- `backend/app/services/local_llm.py`
- `backend/requirements.txt`
- `backend/.env.example`
- `backend/.env` (local only, gitignored)

### Notes

- The keyword/heuristic fallback in `answer_generator.py` and
  `request_analyser.py` still applies if the LLM call raises `LocalLLMError`,
  so a missing/invalid key degrades gracefully rather than 500-ing every chat
  request.
- `OLLAMA_API_KEY` is covered by `.gitignore` (`backend/.env` / `backend/.env.*`
  with the `!backend/.env.example` exception); the real key is never committed.
