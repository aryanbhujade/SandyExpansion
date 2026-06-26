# Sandy Connect — First-Time Setup Guide

This guide takes you from a fresh clone to a running app with **465 employees**,
the Sandy bot, and a Microsoft‑Teams‑style chat. Follow it top to bottom.

> **Working directory:** `test/SandyExpansion/`
> All commands below are relative to this directory unless noted.

---

## 0. Prerequisites

| Tool | Why | Check |
|------|-----|-------|
| **Docker Desktop** (with Compose v2) | Runs the PostgreSQL database | `docker --version` and `docker compose version` |
| **Python 3.11+** (3.14 used in dev) | Backend | `python3 --version` |
| **Node.js 20+** (v26 used in dev) | Frontend | `node --version` |
| **Git** | You already cloned this repo | — |

You do **not** need to install PostgreSQL locally — it runs in Docker.

---

## 1. Start the database (PostgreSQL in Docker)

```bash
cd backend
docker compose up -d
```

This starts a `postgres:16` container named `sandy-postgres` on **host port 5433**
(mapped to the container's 5432). Port 5432 is skipped because it's commonly
occupied on dev machines.

Check it's healthy:

```bash
docker compose ps          # Status should be "healthy"
docker compose logs postgres | tail
```

**Data persistence:** the database lives in a Docker named volume `sandy_pgdata`.
* `docker compose stop` / `docker compose down` → **keeps** your data.
* `docker compose down -v` → **wipes** the volume (fresh start). Only do this to reset.

So your chats, prompt history, and contacts survive server restarts and only
disappear if you explicitly wipe the volume.

---

## 2. Configure the backend environment

```bash
cd backend
cp .env.example .env
```

Then open `backend/.env` and fill in the secret values. The shareable
`.env.example` already has safe defaults for everything except the LLM key:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql+psycopg://sandy:sandy@localhost:5433/sandy_connect` | Matches `docker-compose.yml`. Don't change unless you changed the compose creds. |
| `OLLAMA_MODEL` | `glm-5.2:cloud` | `:cloud` models route to Ollama Cloud. |
| `OLLAMA_API_KEY` | *your key* | Get one from Ollama Cloud. **Never commit this.** `.env` is gitignored. |
| `OLLAMA_BASE_URL` | *(blank)* | Leave blank for Ollama Cloud with a `:cloud` model. |
| `SANDY_ADMIN_EMAIL` | `dev.malhotra@example.com` | This credential is promoted to admin on startup. Keep it. |
| `SANDY_JWT_SECRET` | `change-me-for-local-development` | Any string for local dev. |
| `SANDY_ENV` | `development` | |

> **Do not** change `SANDY_ADMIN_EMAIL`. `dev.malhotra@example.com` (employee
> E015, the CTO) is the seeded admin used by the app and the list/verify scripts.

---

## 3. Install backend dependencies & run

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Run the API server:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### What happens on first launch (auto‑seed)

On startup the backend checks the database and **auto‑seeds it from empty** —
you do **not** run any seed script manually. Watch the console:

```
Sandy Connect database is empty. Auto-seeding curated 15-set...
Successfully auto-seeded credentials.
Promoted dev.malhotra@example.com to admin.
Synthetic 450-set (E016..E465) absent. Auto-seeding on top of the 15-set...
Auto-seeded 450 synthetic employees (450 new credentials). Org total: 465 employees.
```

On later restarts you'll see `Sandy Connect ready: 465 employees in DB.` — it
never re‑seeds or overwrites your chats/edits.

Verify:

```bash
curl http://127.0.0.1:8000/health
# {"status":"ok","llm_provider":"ollama","model":"glm-5.2:cloud","database":"postgresql"}
```

---

## 4. Install frontend dependencies & run

```bash
cd frontend
cp .env.example .env          # VITE_API_BASE_URL=http://localhost:8000 is fine
npm install
npm run dev
```

Vite prints a local URL, usually **http://localhost:5173**. Open it in your browser.

---

## 5. Log in

Everyone has the same default password: **`Password123!`**

| Account | Email | Role |
|---------|-------|------|
| **Admin** | `dev.malhotra@example.com` | CTO (E015) — sees the Analytics/Admin button |
| Any employee | `<firstname.lastname>@example.com` | e.g. `dinesh.nair@example.com` (E016, CTO) |

All 465 emails follow `firstname.lastname@example.com`. Browse them with the
helper script (run while the backend is up):

```bash
cd backend
.venv/bin/python list_employees.py --limit 1000          # list everyone
.venv/bin/python list_employees.py --search "priya"
.venv/bin/python list_employees.py --department DevOps
```

---

## 6. How the chat works (Teams‑style)

The left sidebar is intentionally **not** a list of all 465 people. It works
like Microsoft Teams chat:

* **Sandy bot** is always at the top — ask it "Who knows AWS?", "Find React
  experts", etc. It recommends the right people from the directory.
* **Direct Messages** shows only your **active conversations** — people you've
  already messaged, or people Sandy routed to you via a recommendation.
* A **search bar** above the DM list lets you look up anyone by name, role, or
  department on demand. Click a result to open a conversation.
* **Starting a conversation:** search for someone → click → send a message.
  They immediately appear in your sidebar and stay there.
* **Via the bot:** when Sandy recommends someone and you click
  *"Send chat message"*, a direct message is created and that person appears in
  your sidebar automatically.

So a brand‑new account starts with **only the bot** in the sidebar — no contacts
until you search or Sandy routes one to you.

---

## 7. Database migrations (Alembic) — optional reading

The schema is created automatically on startup (`Base.metadata.create_all`) and
the migration state is recorded. If you change SQLAlchemy models in
`app/database.py`, generate a migration and apply it:

```bash
cd backend
.venv/bin/alembic revision --autogenerate -m "describe your change"
.venv/bin/alembic upgrade head
```

For a fresh, `create_all`‑built database you can also just stamp the current
state without running migrations:

```bash
.venv/bin/alembic stamp head
```

---

## 8. Troubleshooting

**`docker compose up` fails / port 5433 in use**
The compose file maps host port 5433. If 5433 is also occupied, edit
`docker-compose.yml` (`ports: - "5434:5432"`) **and** `DATABASE_URL` in
`backend/.env` to match.

**Backend says "could not connect to server"**
Make sure Postgres is healthy first: `docker compose ps`. Wait for `healthy`
before starting uvicorn.

**Login fails (401)**
Confirm the email is exactly `firstname.lastname@example.com` and the password is
`Password123!`. The DB must have been auto‑seeded (see the startup log in step 3).

**Sidebar shows no people / search returns nothing**
The sidebar only shows active conversations + search results by design (see
step 6). Use the search bar. If search itself returns nothing, the backend is
likely down — check `curl http://127.0.0.1:8000/health`.

**Want a completely fresh database**
```bash
cd backend
docker compose down -v      # wipes the volume
docker compose up -d
```
Then restart the backend and it auto‑seeds 465 again.

**CORS error in the browser**
The backend allows `http://localhost:5173` and `http://127.0.0.1:5173`. If you
serve the frontend from a different origin, add it to `allow_origins` in
`backend/app/main.py`.

---

## 9. Quick reference — ports & credentials (dev only)

| Thing | Value |
|-------|-------|
| Backend API | http://127.0.0.1:8000 |
| Frontend | http://localhost:5173 |
| Postgres | localhost:5433, db `sandy_connect`, user `sandy`, password `sandy` |
| Admin login | `dev.malhotra@example.com` / `Password123!` |
| Any employee | `firstname.lastname@example.com` / `Password123!` |

> These are dev‑only credentials. Do not reuse them in a shared/production deployment.