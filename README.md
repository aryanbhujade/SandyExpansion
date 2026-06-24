# Sandy Connect — Internal Company Assistant & Peer-to-Peer Chat

Sandy Connect is a hierarchy-aware internal company talent intelligence assistant and peer-to-peer chat system. It uses a **FastAPI backend**, a **React/Vite (TypeScript) frontend**, one local SQLite database, and a local **Ollama Mistral LLM** for request analysis and expert discovery.

---

## 🌟 Key Features

1. **AI Talent Discovery Workspace**:
   - Ask Sandy anything about who to contact (e.g. *"Who works best for AWS?"*, *"Who owns Zoho access requests?"*).
   - Get grounded, level-appropriate recommendations based on the company directory.

2. **Peer-to-Peer Direct Messaging**:
   - Chat with colleagues in real-time.
   - Messages are delivered instantly and saved securely.
   - Sidebar conversations are automatically sorted by the latest message timestamp (newest on top).

3. **Unread Badges & Instant Read Status**:
   - Visual unread badges display the count of new messages from each colleague.
   - Clicking a conversation instantly marks messages as read and clears the badge.

4. **Floating In-App Toast Notifications**:
   - Receive slide-in notifications at the bottom-right corner when a new message arrives from a colleague you aren't currently viewing.
   - Click the toast to hop directly into that conversation.

5. **Self-Service Professional Profiles**:
   - View and update your location, designation, department, skills, projects, and bio/notes through a glassmorphic editor modal.
   - Updates are immediately synced to the company directory and database.

---

## 📋 Prerequisites

Ensure you have the following installed on your machine:
- **Python 3.11+**
- **Node.js 20+**
- **npm** (comes with Node.js)
- **Ollama** (for local LLM capabilities)

---

## 🚀 Step-by-Step Setup Guide

### 1. Initialize Git Repository (if cloning manually)
```bash
git clone https://github.com/aryanbhujade/SandyExpansion.git
cd SandyExpansion
```

### 2. Start local Ollama & Pull Mistral Model
Sandy uses the local Mistral LLM for request analysis and answer generation.
```bash
# Start the Ollama server
ollama serve

# In a new terminal, download the Mistral model
ollama pull mistral
```

---

### 3. Backend Setup

Open a new terminal window at the repository root and navigate to the `backend` directory:
```bash
cd backend

# Create a virtual environment
python -m venv .venv

# Activate virtual environment
# On macOS/Linux:
source .venv/bin/activate
# On Windows:
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy example environment configuration
cp .env.example .env
```

#### Run the Backend Server
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- **Auto-Seeding:** On startup, the backend automatically creates `sandy_connect.db` and seeds it with mock employee profiles plus default credentials if empty.
- **Verification:** You can check if the backend is healthy by visiting `http://127.0.0.1:8000/health` in your browser.

---

### 4. Frontend Setup

Open a new terminal window at the repository root and navigate to the `frontend` directory:
```bash
cd frontend

# Install Node dependencies
npm install

# Copy example environment configuration
cp .env.example .env

# Run the Vite development server
npm run dev
```

The frontend application will boot up at:
```text
http://localhost:5173
```

---

## 🔑 Mock Sign-in Credentials

The application is pre-seeded with several employee profiles. You can sign in using **any** of the usernames below with the default password.

**Default Password:** `Password123!`

There is no public self-signup flow. Demo/local accounts are created from the seeded employee directory, and users sign in with their assigned credentials.

| Name | Role | Username (Email) |
| :--- | :--- | :--- |
| **Anudit Sinha** | Associate Manager | `anudit@example.com` |
| **Aryan Mehta** | Programmer Analyst | `aryan@example.com` |
| **Priya Nair** | Senior Consultant | `priya.nair@example.com` |
| **Ravi Menon** | Lead DevOps Engineer | `ravi.menon@example.com` |
| **Meera Shah** | Business Systems Analyst | `meera.shah@example.com` |
| **Harish Idilingotter** | Associate Manager | `harish@example.com` |
| **Nisha Varma** | Marketing Coordinator | `nisha.varma@example.com` |
| **Karan Bedi** | Solutions Consultant | `karan.bedi@example.com` |
| **Sofia Thomas** | Corporate Operations Manager | `sofia.thomas@example.com` |
| **Vikram Rao** | Senior Architect | `vikram.rao@example.com` |
| **Lena Kapoor** | Marketing Lead | `lena.kapoor@example.com` |
| **Maya Iyer** | Principal Architect | `maya.iyer@example.com` |
| **Neil D'Souza** | Sales Director | `neil.dsouza@example.com` |
| **Grace Fernandes** | Head of Corporate | `grace.fernandes@example.com` |
| **Dev Malhotra** | CTO | `dev.malhotra@example.com` |

---

## 🧪 Automated Testing & Mock Runs

To run verification queries against the recommendation engine:
```bash
cd backend
source .venv/bin/activate
python test_sandy_connect.py
```
This script runs a series of mock searches (e.g., *"Who works best for AWS?"*) through the backend query parser and contact ranker and prints out grounded recommendations.

### Reset Local Demo Database

To return the local database to the original seeded employee/knowledge state, stop the backend server and run:

```bash
cd backend
source .venv/bin/activate
python reset_database.py --yes
```

This keeps only the seeded employees, employee profiles, responsibility topics, and demo credentials. It clears chat history, direct messages, recommendations, contact requests, notifications, and feedback.

---

## ⚙️ Configuration Notes
- **Recommendation Confirmations:** When a user confirms a recommendation, Sandy creates a direct chat message from the requester to the recommended employee and stores a lightweight notification/audit record.
- **Delayed Feedback:** Sandy waits two minutes after a recommendation is confirmed, then asks the requester whether the recommendation helped. Once shown, the prompt stays available after switching chats or reloading until feedback is submitted.
- **Offline Fallback:** If Ollama is not running, the backend falls back to standard keyword-matching logic to parse searches and find contacts.
- **Vite Environment:** Change API endpoints in `frontend/.env` if running the backend on a different port or host.
- **Database Design:** See [`DATABASE.md`](DATABASE.md) for schema relationships, data flows, and confidentiality rules.

### 🔐 Authentication & Admin (Phase 3)

The backend reads these environment variables (all optional with defaults, included in `backend/.env.example`):

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `SANDY_ENV` | `development` | Set to `production` to require `SANDY_JWT_SECRET`. |
| `SANDY_JWT_SECRET` | (ephemeral in dev) | JWT signing secret. **Required** when `SANDY_ENV=production`. |
| `SANDY_ACCESS_TOKEN_MINUTES` | `10080` (7 days) | Access token lifetime. |
| `SANDY_ADMIN_EMAIL` | `dev.malhotra@example.com` | Credential promoted to admin on startup. |

An **admin is a normal user with an `is_admin` flag** — there is no separate admin account system. On startup the backend promotes the credential matching `SANDY_ADMIN_EMAIL` (the seeded CTO, `dev.malhotra@example.com` / `Password123!`). Admins see an **Analytics & Admin** button in the chat header (and a landing-page CTA) that opens the admin analytics dashboard at `/analytics`. Non-admin users get `403` from the `/api/analytics/*` endpoints and are redirected away from `/analytics` on the frontend. Logging out revokes the current token (jti-based).

To use the admin features after pulling: **restart the backend** (so the startup migration + admin promotion run) and **log in fresh** as `dev.malhotra@example.com` (the admin claim is embedded in the JWT at login time).
