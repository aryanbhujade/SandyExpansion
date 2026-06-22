# Sandy Connect — Internal Company Assistant & Peer-to-Peer Chat

Sandy Connect is a hierarchy-aware internal company talent intelligence assistant and peer-to-peer chat system. It uses a **FastAPI backend**, a **React/Vite (TypeScript) frontend**, SQLite databases, and a local **Ollama Mistral LLM** for request analysis and expert discovery.

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
- **Auto-Seeding:** On startup, the backend automatically creates SQLite databases (`sandy_connect.db` and `sandy_auth.db`) and seeds them with mock employee profiles and credentials if empty.
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

| Name | Designation | Username (Email) |
| :--- | :--- | :--- |
| **Anudit Sinha** | Cloud Engineer | `anudit@example.com` |
| **Aryan Mehta** | Programmer Analyst | `aryan@example.com` |
| **Priya Nair** | Senior Consultant | `priya.nair@example.com` |
| **Ravi Menon** | Lead Architect | `ravi.menon@example.com` |
| **Meera Shah** | Associate Consultant | `meera.shah@example.com` |
| **Harish Idilingotter** | Manager | `harish@example.com` |
| **Nisha Varma** | Senior Developer | `nisha.varma@example.com` |
| **Karan Bedi** | QA Analyst | `karan.bedi@example.com` |

---

## 🧪 Automated Testing & Mock Runs

To run verification queries against the recommendation engine:
```bash
cd backend
source .venv/bin/activate
python test_sandy_connect.py
```
This script runs a series of mock searches (e.g., *"Who works best for AWS?"*) through the backend query parser and contact ranker and prints out grounded recommendations.

---

## ⚙️ Configuration Notes
- **Email Notifications:** Email delivery is mocked; outgoing email details are logged and stored in the database but not sent to real SMTP hosts.
- **Offline Fallback:** If Ollama is not running, the backend falls back to standard keyword-matching logic to parse searches and find contacts.
- **Vite Environment:** Change API endpoints in `frontend/.env` if running the backend on a different port or host.
