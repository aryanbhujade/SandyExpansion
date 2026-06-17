# SandyExpansion

SandyExpansion is a local demo of Sandy Connect, a hierarchy-aware internal company connection assistant. It uses a FastAPI backend, a React/Vite frontend, SQLite seed data, and local Ollama Mistral for request analysis and answer generation.

## Prerequisites

- Python 3.11+
- Node.js 20+
- npm
- Ollama installed locally

## Clone

```bash
git clone https://github.com/aryanbhujade/SandyExpansion.git
cd SandyExpansion
```

## Start Ollama

Sandy Connect uses local Ollama Mistral by default.

```bash
ollama serve
ollama pull mistral
```

Optional model smoke test:

```bash
ollama run mistral
```

## Backend Setup

```bash
cd backend
python -m venv sandyvenv
source sandyvenv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Default backend environment:

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
DATABASE_URL=sqlite:///./sandy_connect.db
SANDY_TEST_NOTIFICATION_EMAIL=aryan.bhujade@sandhata.com
```

Seed the SQLite database:

```bash
python -m app.services.seed_data
```

Run the backend:

```bash
uvicorn app.main:app --reload --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

## Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The frontend runs at:

```text
http://localhost:5173
```

## Test The Backend

Ask Sandy Connect a question:

```bash
curl -X POST http://127.0.0.1:8000/ask \
  -H "Content-Type: application/json" \
  -d '{
    "user_name": "Aryan",
    "user_level": "L2",
    "user_role": "Programmer Analyst",
    "user_department": "Technology",
    "message": "Who works best for AWS?"
  }'
```

Seed through the API if needed:

```bash
curl -X POST http://127.0.0.1:8000/admin/seed
```

Confirm a recommendation notification. Replace `1` with the `recommendation_id` returned by `/ask`.

```bash
curl -X POST http://127.0.0.1:8000/recommendations/1/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "requester_name": "Aryan",
    "notification_channel": "email"
  }'
```

Mark a contact request as fulfilled. Replace `1` with the returned `contact_request_id`.

```bash
curl -X POST http://127.0.0.1:8000/contact-requests/1/fulfilled
```

Submit feedback:

```bash
curl -X POST http://127.0.0.1:8000/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "contact_request_id": 1,
    "was_useful": true,
    "rating": 5,
    "feedback_text": "This was the right contact."
  }'
```

## Run The Demo Script

```bash
cd backend
source sandyvenv/bin/activate
python test_sandy_connect.py
```

The script seeds local data if needed and runs example queries through the recommendation pipeline.

## Notes

- Email is currently mocked. The backend stores outgoing notification records but does not send real email yet.
- The mock notification recipient defaults to `aryan.bhujade@sandhata.com`.
- The local database is SQLite and is created as `backend/sandy_connect.db`.
- If Ollama is unavailable, the backend falls back to safe deterministic logic for analysis and answer generation.
- The frontend falls back to demo mode if the backend is unavailable.
- On Windows, activate the backend virtual environment with `sandyvenv\Scripts\activate`.
