// ============================================================
// Chat Context — shared state management for the chat feature.
// Encapsulates messages, session, and API calls.
// Falls back to mock responses when the backend is unreachable.
// ============================================================

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { chatApi, healthApi } from '@/services/api';
import type { Message, RecommendationItem } from '@/types';

interface ChatContextValue {
  messages: Message[];
  sessionId: string;
  isTyping: boolean;
  recommendations: RecommendationItem[];
  sendMessage: (text: string) => Promise<void>;
  clearChat: () => void;
  backendAvailable: boolean | null; // null = not checked yet
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

// ---------- Mock fallback (used when backend is not running) ----------

function generateMockResponse(userText: string): { message: string; recommendations: RecommendationItem[] } {
  return {
    message: `Great question! I found several experts related to "${userText}". Here are the top recommendations:\n\n• **Priya Sharma** — Senior Engineer, 5 years experience\n• **Alex Chen** — Tech Lead, contributed to 12 projects\n• **Jordan Lee** — Mentor, rated 4.9/5 by mentees\n\nWould you like more details about any of them?`,
    recommendations: [
      {
        employee_id: 'EMP0042',
        name: 'Priya Sharma',
        designation: 'Senior Consultant',
        level: 'L5',
        department: 'Technology',
        top_skills: [{ name: userText.split(' ')[0] || 'General', proficiency: 5 }],
        reason: 'Subject Matter Expert with 5 years of hands-on experience.',
      },
      {
        employee_id: 'EMP0108',
        name: 'Alex Chen',
        designation: 'Lead Consultant',
        level: 'L6',
        department: 'Engineering',
        top_skills: [{ name: userText.split(' ')[0] || 'General', proficiency: 4 }],
        reason: 'Tech Lead who has contributed to 12 related projects.',
      },
      {
        employee_id: 'EMP0215',
        name: 'Jordan Lee',
        designation: 'Consultant',
        level: 'L4',
        department: 'Technology',
        top_skills: [{ name: userText.split(' ')[0] || 'General', proficiency: 4 }],
        reason: 'Available as a mentor, rated 4.9/5 by past mentees.',
      },
    ],
  };
}

function generateSessionId(): string {
  // Simple UUID-like generator without external dependency
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ---------- Provider ----------

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'bot',
      content: 'Hello! I\'m InternBot 🤖 I can help you discover the right experts across your organization. Try asking me about specific technologies, projects, or skills!',
      timestamp: new Date(),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const sessionIdRef = useRef(generateSessionId());

  // Check backend availability on mount
  useEffect(() => {
    healthApi.isAvailable().then(setBackendAvailable);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return;

    // 1. Add user message immediately
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setRecommendations([]);

    try {
      if (backendAvailable) {
        // --- Real API call ---
        const response = await chatApi.sendMessage(
          text.trim(),
          sessionIdRef.current
        );

        // Update session ID from server
        sessionIdRef.current = response.session_id;

        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          role: 'bot',
          content: response.message,
          recommendations: response.recommendations,
          domain: response.domain,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMsg]);
        setRecommendations(response.recommendations);
      } else {
        // --- Mock fallback ---
        await new Promise(resolve => setTimeout(resolve, 1500)); // simulate latency
        const mock = generateMockResponse(text);

        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          role: 'bot',
          content: mock.message,
          recommendations: mock.recommendations,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMsg]);
        setRecommendations(mock.recommendations);
      }
    } catch (error) {
      // Network error — fall back to mock
      console.warn('[ChatContext] API call failed, using mock fallback:', error);
      const mock = generateMockResponse(text);

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: 'bot',
        content: mock.message,
        recommendations: mock.recommendations,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
      setRecommendations(mock.recommendations);
    } finally {
      setIsTyping(false);
    }
  }, [isTyping, backendAvailable]);

  const clearChat = useCallback(() => {
    sessionIdRef.current = generateSessionId();
    setMessages([
      {
        id: 'welcome',
        role: 'bot',
        content: 'Hello! I\'m InternBot 🤖 I can help you discover the right experts across your organization. Try asking me about specific technologies, projects, or skills!',
        timestamp: new Date(),
      },
    ]);
    setRecommendations([]);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        sessionId: sessionIdRef.current,
        isTyping,
        recommendations,
        sendMessage,
        clearChat,
        backendAvailable,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

// ---------- Hook ----------

export function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}
