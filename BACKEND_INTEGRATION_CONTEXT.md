# 🔧 Backend Integration Guide — InternBot

> **For:** Backend developer working on the FastAPI server  

---

## 📌 Overview

The React frontend is fully built and ready to connect to the backend. This document tells you **exactly** what the frontend expects — every endpoint, every request/response shape, every header — so you can build the FastAPI backend with zero guesswork.

The frontend automatically detects whether the backend is running. If it is, it calls the real API. If not, it falls back to mock responses. So you can develop independently and test integration at any point.

---

## 🚀 Quick Start (for testing integration)

1. Start the FastAPI backend on `http://localhost:8000`
2. The frontend reads `VITE_API_BASE_URL` from its `.env` file (defaults to `http://localhost:8000`)
3. On page load, the frontend hits `GET /docs` to check if the backend is alive
4. If reachable → all chat messages go to `POST /api/chat`
5. If unreachable → frontend uses mock data (no errors shown to user)

### CORS Configuration

The frontend runs on `http://localhost:5173` (Vite dev server). You **must** enable CORS in FastAPI:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:4173",   # Vite preview
        "http://localhost:3000",   # Alternate dev port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 📡 API Endpoints the Frontend Calls

### 1. `POST /api/chat` — **Main Chat Endpoint (Priority 1)**

This is the most critical endpoint. The entire chat experience depends on it.

**Request:**

```json
{
  "message": "Who is the best person for React development?",
  "requester_id": "EMP0001",
  "session_id": "session-1718520000000-abc1234"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `message` | `string` | ✅ | The user's natural language query |
| `requester_id` | `string` | ✅ | Employee ID of the person asking. Currently hardcoded to `EMP0001` (will come from auth later) |
| `session_id` | `string \| null` | ❌ | If null, backend should generate one and return it. If provided, append to existing session |

**Expected Response:**

```json
{
  "message": "I found 3 experts who can help with React development! Here are my top recommendations:",
  "domain": "Frontend / React",
  "recommendations": [
    {
      "employee_id": "EMP0042",
      "name": "Priya Sharma",
      "designation": "Senior Consultant",
      "level": "L5",
      "department": "Technology",
      "top_skills": [
        { "name": "React", "proficiency": 5 },
        { "name": "TypeScript", "proficiency": 4 }
      ],
      "reason": "Priya is a Subject Matter Expert in React with 5 years of hands-on experience and has led 3 React-based projects."
    },
    {
      "employee_id": "EMP0108",
      "name": "Alex Chen",
      "designation": "Lead Consultant",
      "level": "L6",
      "department": "Engineering",
      "top_skills": [
        { "name": "React", "proficiency": 4 },
        { "name": "Next.js", "proficiency": 5 }
      ],
      "reason": "Alex has deep expertise in React ecosystem including Next.js, and is available as a mentor."
    }
  ],
  "session_id": "session-1718520000000-abc1234"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `message` | `string` | ✅ | Friendly text shown to the user in the chat bubble. **Supports markdown bold** (`**name**`) — the frontend renders `**text**` as bold emerald-colored text |
| `domain` | `string` | ✅ | The domain/topic the LLM identified (e.g., "Frontend / React", "DevOps", "Machine Learning") |
| `recommendations` | `array` | ✅ | Array of recommended employees (2–3 ideal). Can be empty `[]` if no match found |
| `session_id` | `string` | ✅ | Echo back the provided session_id, or return a newly generated one |

**Recommendation Item Shape:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `employee_id` | `string` | ✅ | Format: `EMP0001` |
| `name` | `string` | ✅ | Full employee name |
| `designation` | `string` | ✅ | Current job title |
| `level` | `string` | ✅ | Org level (`L1`–`L18`) |
| `department` | `string` | ✅ | Department name |
| `top_skills` | `array` | ✅ | Array of `{ name: string, proficiency: number }`. Proficiency is 1–5 |
| `reason` | `string` | ✅ | Short explanation of why this person was recommended |

**Error Response:**

```json
{
  "detail": "LLM service unavailable"
}
```

The frontend catches all errors gracefully and falls back to mock data, so return standard FastAPI error responses.

---

### 2. `GET /api/chat/history` — Chat History

**Query Parameters:**

| Param | Type | Notes |
|---|---|---|
| `session_id` | `string` | Required. Returns messages for this session |

**Expected Response:** Array of past chat log entries (shape is flexible, frontend doesn't consume this yet — build it for future use).

---

### 3. `GET /api/employees` — Employee Directory

**Query Parameters (all optional):**

| Param | Type | Notes |
|---|---|---|
| `department` | `string` | Filter by department |
| `level` | `string` | Filter by org level (e.g., `L5`) |
| `business_unit` | `string` | Filter by business unit |
| `location` | `string` | Filter by office location |
| `mentor_available` | `boolean` | Filter mentors only |
| `search` | `string` | Full-text search on name/bio/skills |
| `page` | `number` | Pagination page (default: 1) |
| `limit` | `number` | Items per page (default: 20) |

**Expected Response:** Array of `Employee` objects:

```json
[
  {
    "employee_id": "EMP0001",
    "name": "Ananya Sharma",
    "email": "ananya.sharma@company.com",
    "level": "L8",
    "designation": "Associate Architect",
    "department": "Architecture",
    "business_unit": "Technology",
    "location": "Chennai",
    "manager_id": "EMP0005",
    "experience_years": 8,
    "domains": ["UI Design", "Design Systems"],
    "technologies": ["Figma", "Adobe XD"],
    "skills": [
      { "name": "Figma", "proficiency": 5 },
      { "name": "Design Systems", "proficiency": 5 }
    ],
    "projects": ["Design System Revamp"],
    "bio": "Experienced UI/UX designer...",
    "mentor_available": true,
    "created_at": "2026-01-15T10:30:00Z",
    "updated_at": "2026-06-01T14:00:00Z"
  }
]
```

---

### 4. `GET /api/employees/{employee_id}` — Single Employee

Returns a single `Employee` object (same shape as above).

---

### 5. `GET /api/notifications` — User Notifications

**Expected Response:**

```json
[
  {
    "id": 1,
    "chat_log_id": 42,
    "notified_emp_id": "EMP0042",
    "requester_id": "EMP0001",
    "channel": "in_app",
    "status": "sent",
    "topic": "React Development",
    "sent_at": "2026-06-16T10:00:00Z",
    "read_at": null,
    "created_at": "2026-06-16T10:00:00Z"
  }
]
```

### 6. `PUT /api/notifications/{id}/read` — Mark as Read

No request body needed. Returns `200 OK`.

---

## 🧩 TypeScript Types (Frontend Reference)

The frontend defines these types in `src/types/index.ts`. Your Pydantic schemas should produce JSON that matches these exactly:

```typescript
// What the frontend sends
interface ChatRequest {
  message: string;
  requester_id: string;
  session_id?: string;
}

// What the frontend expects back
interface ChatResponse {
  message: string;
  domain: string;
  recommendations: RecommendationItem[];
  session_id: string;
}

interface RecommendationItem {
  employee_id: string;
  name: string;
  designation: string;
  level: string;
  department: string;
  top_skills: SkillItem[];
  reason: string;
}

interface SkillItem {
  name: string;
  proficiency: number; // 1-5
}
```

---

## 🤖 LLM Response Format

The LLM (Ollama/Claude) should be prompted to return JSON matching the `ChatResponse` schema above. The `message` field is displayed directly in the chat UI, so it should be:

- Friendly and conversational
- Can use `**bold**` for emphasis (the frontend renders it)
- Should reference the recommended people by name
- Keep it concise (2–4 sentences max)

### Example System Prompt Guidance

```
Return JSON with these fields:
- "message": friendly text for the user
- "domain": the detected domain/topic
- "recommendations": array of 2-3 experts with employee_id, name, designation, level, department, top_skills (array of {name, proficiency}), and reason
- "session_id": echo back the provided session_id
```

---

## 🔑 Authentication (Future)

Currently there is no auth. The frontend sends a hardcoded `requester_id: "EMP0001"` (configurable via `VITE_DEFAULT_REQUESTER_ID` env var).

When you add auth (FastAPI-Users + JWT as per the architecture doc):
1. The frontend will store the JWT token (likely in localStorage or httpOnly cookie)
2. The API client (`src/services/api.ts`) has an Axios instance where you can add an interceptor for the `Authorization: Bearer <token>` header
3. The `requester_id` will then come from the authenticated session instead of the env var

---

## ⚙️ Environment & Ports

| Service | Default Port | Notes |
|---|---|---|
| Frontend (Vite) | `5173` | `npm run dev` |
| Backend (FastAPI) | `8000` | `uvicorn app.main:app --reload` |
| Ollama | `11434` | Local LLM server |
| PostgreSQL | `5432` | Database |
| ChromaDB | embedded | No separate port needed |

---

## 🧪 Testing Integration

### Step-by-step:

1. Start your FastAPI server: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
2. Verify it's running: `curl http://localhost:8000/docs` (should return the Swagger UI)
3. The frontend will automatically detect the backend on next page load
4. Look for the **"API Connected"** badge in the top-right corner of the chat page
5. Send a message — it should hit your `POST /api/chat` endpoint
6. Check your FastAPI logs for the incoming request

### Common Issues:

| Problem | Solution |
|---|---|
| Frontend shows "Demo Mode" even though backend is running | Check CORS is configured. Check the port matches `VITE_API_BASE_URL` |
| `Network Error` in browser console | CORS not enabled, or backend not running on expected port |
| Request hits backend but response fails | Verify response JSON matches the `ChatResponse` schema exactly |
| `422 Unprocessable Entity` | Request body doesn't match `ChatRequest` schema — check field names and types |

---

## 📁 Frontend File Reference

```
src/
├── types/index.ts          # All TypeScript interfaces (mirror your Pydantic schemas here)
├── services/api.ts         # Axios client — all API calls go through here
├── context/ChatContext.tsx  # Chat state management (API call + mock fallback logic)
├── pages/
│   ├── LandingPage.tsx     # Landing page (no backend dependency)
│   └── ChatPage.tsx        # Chat UI (consumes ChatContext)
└── App.tsx                 # Routes & providers
```

---

## ✅ Priority Order for Backend Development

1. **`POST /api/chat`** — This is the core feature. Get this working first with a simple hardcoded response, then add the LLM.
2. **CORS middleware** — Without this, nothing works from the browser.
3. **ChromaDB + LLM integration** — Wire up the actual recommendation engine.
4. **`GET /api/employees`** — For the future directory page.
5. **Notifications** — Lower priority, can be added incrementally.
6. **Auth (JWT)** — Last, once everything else works.

---

> 💡 **Tip:** Start by creating a minimal `POST /api/chat` that returns a hardcoded `ChatResponse` JSON. That will immediately light up the "API Connected" badge and let you verify end-to-end connectivity before touching the LLM or database.
