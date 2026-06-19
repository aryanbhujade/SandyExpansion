# Changes Made

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
