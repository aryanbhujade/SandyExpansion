// ============================================================
// Centralized API service layer
// All HTTP calls to the FastAPI backend go through here.
// ============================================================

import axios, { type AxiosInstance } from 'axios';
import type {
  ChatRequest,
  ChatResponse,
  Employee,
  EmployeeFilters,
  Notification,
} from '@/types';

// ---------- Axios Instance ----------

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const REQUESTER_ID = import.meta.env.VITE_DEFAULT_REQUESTER_ID || 'EMP0001';

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // 30s — LLM responses can be slow
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  /**
   * Check if the backend is reachable.
   * Used to decide whether to use real API or mock fallback.
   */
  async isAvailable(): Promise<boolean> {
    try {
      await apiClient.get('/docs', { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  },
};

export default apiClient;
