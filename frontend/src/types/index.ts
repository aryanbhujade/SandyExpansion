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
  role: string;
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
  recommendation_id?: number;
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
  confirmation_required?: boolean;
  confirmation_prompt?: string | null;
}

export interface ConfirmRecommendationResponse {
  status: string;
  message: string;
  contact_request: {
    contact_request_id: number;
    recommendation_id: number;
    topic: string | null;
    recommended_employee_id: string;
    status: string;
    notification_message: string;
    notification?: {
      recipient_email: string | null;
      subject: string;
      status: string;
    };
  };
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

export interface RecommendationNotificationState {
  contactRequestId?: number;
  status: 'idle' | 'sending' | 'sent' | 'error';
  message?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  recommendations?: RecommendationItem[];
  domain?: string;
  confirmationRequired?: boolean;
  confirmationPrompt?: string | null;
  recommendationStates?: Record<number, RecommendationNotificationState>;
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

// ---------- Profile & Active Conversations ----------

export interface EmployeeProfileData {
  employee_id: string;
  name: string;
  email: string;
  level: string;
  role: string;
  department: string;
  business_unit: string;
  location: string;
  skills: string[];
  expertise_topics: string[];
  projects: string[];
  notes: string;
}

export interface ProfileUpdatePayload {
  role?: string;
  department?: string;
  location?: string;
  skills?: string[];
  expertise_topics?: string[];
  projects?: string[];
  notes?: string;
}

export interface ActiveConversation {
  last_message: string;
  timestamp: string;
  sender_id: string;
  read: boolean;
}
