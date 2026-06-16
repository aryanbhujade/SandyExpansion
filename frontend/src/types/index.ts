// ============================================================
// TypeScript types mirroring FastAPI Pydantic schemas
// from: intern_chatbot_architecture.md
// ============================================================

// ---------- Employee ----------

export interface SkillItem {
  name: string;
  proficiency: number; // 1–5 (1=Beginner, 5=SME)
}

export interface Employee {
  employee_id: string;     // "EMP0001"
  name: string;
  email: string;
  level: string;           // "L1" to "L18"
  designation: string;
  department: string;
  business_unit: string;
  location: string;
  manager_id: string | null;
  experience_years: number;
  domains: string[];
  technologies: string[];
  skills: SkillItem[];
  projects: string[];
  bio: string;
  mentor_available: boolean;
  created_at?: string;
  updated_at?: string;
}

// ---------- Chat ----------

export interface ChatRequest {
  message: string;
  requester_id: string;    // employee_id of the person asking
  session_id?: string;
}

export interface RecommendationItem {
  employee_id: string;
  name: string;
  designation: string;
  level: string;
  department: string;
  top_skills: SkillItem[];
  reason: string;
}

export interface ChatResponse {
  message: string;
  domain: string;
  recommendations: RecommendationItem[];
  session_id: string;
}

// ---------- Notifications ----------

export interface Notification {
  id: number;
  chat_log_id: number;
  notified_emp_id: string;
  requester_id: string;
  channel: 'email' | 'in_app';
  status: 'pending' | 'sent' | 'failed' | 'read';
  topic: string;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

// ---------- UI Message (frontend-only) ----------

export interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  recommendations?: RecommendationItem[];
  domain?: string;
  timestamp: Date;
}

// ---------- API Filters ----------

export interface EmployeeFilters {
  department?: string;
  level?: string;
  business_unit?: string;
  location?: string;
  mentor_available?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}
