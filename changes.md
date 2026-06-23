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
