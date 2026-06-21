// ============================================================
// Chat Context — shared state management for the chat feature.
// Encapsulates messages, session, and API calls.
// Falls back to mock responses when the backend is unreachable.
// Persists sessionId in localStorage for chat history continuity.
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
  confirmRecommendation: (messageId: string, recommendationId: number) => Promise<void>;
  clearChat: () => void;
  backendAvailable: boolean | null; // null = not checked yet
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

// ---------- Session persistence ----------

const SESSION_KEY = 'internbot_session_id';

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getOrCreateSessionId(): string {
  const stored = localStorage.getItem(SESSION_KEY);
  if (stored) return stored;
  const newId = generateSessionId();
  localStorage.setItem(SESSION_KEY, newId);
  return newId;
}

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

function stripConfirmationPrompt(content: string, prompt?: string | null): string {
  if (!prompt) return content;
  return content.replace(prompt, '').trim();
}

function createRecommendationStates(recommendations: RecommendationItem[]) {
  return recommendations.reduce<Record<number, { status: 'idle' }>>((states, recommendation) => {
    if (recommendation.recommendation_id !== undefined) {
      states[recommendation.recommendation_id] = { status: 'idle' };
    }
    return states;
  }, {});
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
  const [sessionId, setSessionId] = useState(getOrCreateSessionId);
  const inFlightRef = useRef(false);

  // Check backend availability on mount
  useEffect(() => {
    healthApi.isAvailable().then(setBackendAvailable);
  }, []);

  // Restore chat history from backend on mount
  useEffect(() => {
    if (backendAvailable !== true) return;

    chatApi.getHistory(sessionId)
      .then(history => {
        if (!history || history.length === 0) return;

        const restoredMessages: Message[] = [
          {
            id: 'welcome',
            role: 'bot',
            content: 'Hello! I\'m InternBot 🤖 I can help you discover the right experts across your organization. Try asking me about specific technologies, projects, or skills!',
            timestamp: new Date(),
          },
        ];

        for (const entry of history) {
          restoredMessages.push({
            id: `restored-user-${entry.id}`,
            role: 'user',
            content: entry.message,
            timestamp: new Date(entry.created_at),
          });
          restoredMessages.push({
            id: `restored-bot-${entry.id}`,
            role: 'bot',
            content: entry.bot_response,
            timestamp: new Date(entry.created_at),
          });
        }

        setMessages(restoredMessages);
      })
      .catch(() => {
        // Silently ignore restore errors
      });
  }, [backendAvailable, sessionId]);

  const sendMessage = useCallback(async (text: string) => {
    const cleanText = text.trim();
    if (!cleanText || inFlightRef.current) return;
    inFlightRef.current = true;

    // 1. Add user message immediately
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: cleanText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setRecommendations([]);

    try {
      if (backendAvailable !== false) {
        // --- Real API call ---
        const response = await chatApi.sendMessage(
          cleanText,
          sessionId
        );

        // Update session ID from server and persist
        setSessionId(response.session_id);
        localStorage.setItem(SESSION_KEY, response.session_id);
        setBackendAvailable(true);
        const hasConfirmableRecommendations = response.recommendations.some(
          recommendation => recommendation.recommendation_id !== undefined
        );
        const confirmationRequired = Boolean(
          response.confirmation_required && hasConfirmableRecommendations
        );

        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          role: 'bot',
          content: stripConfirmationPrompt(response.message, response.confirmation_prompt),
          recommendations: response.recommendations,
          domain: response.domain,
          confirmationRequired,
          confirmationPrompt: confirmationRequired ? response.confirmation_prompt : null,
          recommendationStates: createRecommendationStates(response.recommendations),
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMsg]);
        setRecommendations(response.recommendations);
      } else {
        // --- Mock fallback ---
        await new Promise(resolve => setTimeout(resolve, 1500)); // simulate latency
        const mock = generateMockResponse(cleanText);

        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          role: 'bot',
          content: mock.message,
          recommendations: mock.recommendations,
          recommendationStates: createRecommendationStates(mock.recommendations),
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMsg]);
        setRecommendations(mock.recommendations);
      }
    } catch (error) {
      // Network error — fall back to mock
      console.warn('[ChatContext] API call failed, using mock fallback:', error);
      setBackendAvailable(false);
      const mock = generateMockResponse(cleanText);

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: 'bot',
        content: mock.message,
        recommendations: mock.recommendations,
        recommendationStates: createRecommendationStates(mock.recommendations),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
      setRecommendations(mock.recommendations);
    } finally {
      inFlightRef.current = false;
      setIsTyping(false);
    }
  }, [backendAvailable, sessionId]);

  const confirmRecommendation = useCallback(async (messageId: string, recommendationId: number) => {
    setMessages(prev => prev.map(message =>
      message.id === messageId
        ? {
            ...message,
            recommendationStates: {
              ...message.recommendationStates,
              [recommendationId]: {
                ...(message.recommendationStates?.[recommendationId] ?? { status: 'idle' }),
                status: 'sending',
                message: undefined,
              },
            },
          }
        : message
    ));

    try {
      const response = await chatApi.confirmRecommendation(recommendationId);
      const recipientEmail = response.contact_request.notification?.recipient_email;
      const statusMessage = recipientEmail
        ? `Notification queued to ${recipientEmail}.`
        : response.message;

      setMessages(prev => prev.map(message =>
        message.id === messageId
          ? {
              ...message,
              recommendationStates: {
                ...message.recommendationStates,
                [recommendationId]: {
                  contactRequestId: response.contact_request.contact_request_id,
                  status: 'sent',
                  message: statusMessage,
                },
              },
            }
          : message
      ));
    } catch (error) {
      console.warn('[ChatContext] Recommendation confirmation failed:', error);
      setMessages(prev => prev.map(message =>
        message.id === messageId
          ? {
              ...message,
              recommendationStates: {
                ...message.recommendationStates,
                [recommendationId]: {
                  ...(message.recommendationStates?.[recommendationId] ?? { status: 'idle' }),
                  status: 'error',
                  message: 'I could not notify the contact. Please try again.',
                },
              },
            }
          : message
      ));
    }
  }, []);

  const clearChat = useCallback(() => {
    const newSessionId = generateSessionId();
    localStorage.setItem(SESSION_KEY, newSessionId);
    setSessionId(newSessionId);
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
        sessionId,
        isTyping,
        recommendations,
        sendMessage,
        confirmRecommendation,
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
