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
  FeedbackRequest,
  FeedbackResponse,
  AnalyticsSummary,
  AnalyticsRecommendation,
  AnalyticsFeedback,
  AnalyticsChatMessage,
  Paginated,
} from '@/types';

// ---------- Axios Instance ----------

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const REQUESTER_ID = import.meta.env.VITE_DEFAULT_REQUESTER_ID || 'EMP0001';
const TOKEN_KEY = 'sandy_connect_token';

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // 30s — LLM responses can be slow
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptor to include JWT token
apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY);
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

  async logout() {
    await apiClient.post('/api/auth/logout');
  }
};

// ---------- Chat API ----------

export const chatApi = {
  /**
   * Send a message to the Sandy Connect LLM agent.
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

  async confirmRecommendation(recommendationId: number): Promise<ConfirmRecommendationResponse> {
    const { data } = await apiClient.post<ConfirmRecommendationResponse>(
      `/recommendations/${recommendationId}/confirm`,
      {
        notification_channel: 'chat',
      }
    );
    return data;
  },

  async submitFeedback(payload: FeedbackRequest): Promise<FeedbackResponse> {
    const { data } = await apiClient.post<FeedbackResponse>('/feedback', payload);
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

// ---------- Analytics API (admin only) ----------

export const analyticsApi = {
  async getSummary(): Promise<AnalyticsSummary> {
    const { data } = await apiClient.get<AnalyticsSummary>('/api/analytics/summary');
    return data;
  },

  async getRecommendations(page = 1, limit = 20): Promise<Paginated<AnalyticsRecommendation>> {
    const { data } = await apiClient.get<Paginated<AnalyticsRecommendation>>('/api/analytics/recommendations', {
      params: { page, limit },
    });
    return data;
  },

  async getFeedback(page = 1, limit = 20): Promise<Paginated<AnalyticsFeedback>> {
    const { data } = await apiClient.get<Paginated<AnalyticsFeedback>>('/api/analytics/feedback', {
      params: { page, limit },
    });
    return data;
  },

  async getChatMessages(page = 1, limit = 20): Promise<Paginated<AnalyticsChatMessage>> {
    const { data } = await apiClient.get<Paginated<AnalyticsChatMessage>>('/api/analytics/chat-messages', {
      params: { page, limit },
    });
    return data;
  },

  async deleteChatMessage(id: number): Promise<void> {
    await apiClient.delete(`/api/analytics/chat-messages/${id}`);
  },

  async deleteFeedback(id: number): Promise<void> {
    await apiClient.delete(`/api/analytics/feedback/${id}`);
  },
};

export default apiClient;
