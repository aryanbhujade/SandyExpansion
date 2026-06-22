// ============================================================
// Centralized API service layer
// All HTTP calls to the FastAPI backend go through here.
// ============================================================

import axios, { type AxiosInstance } from 'axios';
import type {
  ChatRequest,
  ChatResponse,
  ConfirmRecommendationResponse,
  Employee,
  EmployeeFilters,
  Notification,
  EmployeeProfileData,
  ProfileUpdatePayload,
  ActiveConversation,
} from '@/types';

// ---------- Axios Instance ----------

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const REQUESTER_ID = import.meta.env.VITE_DEFAULT_REQUESTER_ID || 'EMP0001';
const REQUESTER_NAME = import.meta.env.VITE_DEFAULT_REQUESTER_NAME || 'Aryan';

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // 30s — LLM responses can be slow
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptor to include JWT token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('internbot_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------- Auth API ----------

export const authApi = {
  async login(email: string, password: string) {
    const { data } = await apiClient.post('/api/auth/login', { email, password });
    return data;
  },
  
  async getMe() {
    const { data } = await apiClient.get('/api/auth/me');
    return data;
  },

  async register(name: string, email: string, password: string) {
    const { data } = await apiClient.post('/api/auth/register', { name, email, password });
    return data;
  }
};

// ---------- Chat API ----------

export const chatApi = {
  /**
   * Send a message to the InternBot LLM agent.
   * Returns structured recommendations from the backend.
   */
  async sendMessage(
    message: string,
    sessionId?: string,
    requesterId?: string
  ): Promise<ChatResponse> {
    const payload: ChatRequest = {
      message,
      requester_id: requesterId || REQUESTER_ID,
      session_id: sessionId,
    };
    const { data } = await apiClient.post<ChatResponse>('/api/chat', payload);
    return data;
  },

  /**
   * Fetch chat history for a given session.
   */
  async getHistory(sessionId: string) {
    const { data } = await apiClient.get('/api/chat/history', {
      params: { session_id: sessionId },
    });
    return data;
  },

  async confirmRecommendation(
    recommendationId: number,
    requesterName?: string
  ): Promise<ConfirmRecommendationResponse> {
    const { data } = await apiClient.post<ConfirmRecommendationResponse>(
      `/recommendations/${recommendationId}/confirm`,
      {
        requester_name: requesterName || REQUESTER_NAME,
        notification_channel: 'email',
      }
    );
    return data;
  },
};

// ---------- Employee API ----------

export const employeeApi = {
  /**
   * List employees with optional filters and pagination.
   */
  async list(filters?: EmployeeFilters): Promise<Employee[]> {
    const { data } = await apiClient.get<Employee[]>('/api/employees', {
      params: filters,
    });
    return data;
  },

  /**
   * Get a single employee by their employee_id.
   */
  async getById(employeeId: string): Promise<Employee> {
    const { data } = await apiClient.get<Employee>(`/api/employees/${employeeId}`);
    return data;
  },

  async getFullProfile(employeeId: string): Promise<EmployeeProfileData> {
    const { data } = await apiClient.get<EmployeeProfileData>(`/api/employees/${employeeId}/profile`);
    return data;
  },

  async updateProfile(profileData: ProfileUpdatePayload): Promise<Employee> {
    const { data } = await apiClient.put<Employee>('/api/employees/profile', profileData);
    return data;
  },
};

// ---------- Notification API ----------

export const notificationApi = {
  /**
   * Get all notifications for the current user.
   */
  async list(): Promise<Notification[]> {
    const { data } = await apiClient.get<Notification[]>('/api/notifications');
    return data;
  },

  /**
   * Mark a notification as read.
   */
  async markRead(notificationId: number): Promise<void> {
    await apiClient.put(`/api/notifications/${notificationId}/read`);
  },
};

// ---------- Health Check ----------

export const healthApi = {
  async isAvailable(): Promise<boolean> {
    try {
      await apiClient.get('/health', { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  },
};

// ---------- Messages API ----------

export interface DirectMessage {
  id: number;
  sender_id: string;
  receiver_id: string;
  message: string;
  timestamp: string;
}

export const messageApi = {
  async getMessages(employeeId: string): Promise<DirectMessage[]> {
    const { data } = await apiClient.get<DirectMessage[]>(`/api/messages/${employeeId}`);
    return data;
  },
  
  async sendMessage(employeeId: string, message: string): Promise<DirectMessage> {
    const { data } = await apiClient.post<DirectMessage>(`/api/messages/${employeeId}`, { message });
    return data;
  },

  async getActiveConversations(): Promise<Record<string, ActiveConversation>> {
    const { data } = await apiClient.get<Record<string, ActiveConversation>>('/api/messages/conversations/active');
    return data;
  },
  
  async getUnreadCounts(): Promise<Record<string, number>> {
    const { data } = await apiClient.get<Record<string, number>>('/api/messages/unread/count');
    return data;
  }
};

export default apiClient;
