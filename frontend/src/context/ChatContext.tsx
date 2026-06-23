// ============================================================
// Chat Context — shared state management for the chat feature.
// Encapsulates messages, session, and API calls.
// Falls back to mock responses when the backend is unreachable.
// Persists sessionId in localStorage for chat history continuity.
// ============================================================

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { chatApi, healthApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import type { FeedbackRequest, Message, RecommendationItem, RecommendationNotificationState } from '@/types';

interface ChatContextValue {
  messages: Message[];
  sessionId: string;
  isTyping: boolean;
  recommendations: RecommendationItem[];
  sendMessage: (text: string) => Promise<void>;
  confirmRecommendation: (messageId: string, recommendationId: number) => Promise<void>;
  submitRecommendationFeedback: (
    messageId: string,
    recommendationId: number,
    feedback: Omit<FeedbackRequest, 'recommendation_id' | 'contact_request_id'>
  ) => Promise<void>;
  clearChat: () => void;
  backendAvailable: boolean | null; // null = not checked yet
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

// ---------- Session persistence ----------

const SESSION_KEY = 'internbot_session_id';
const WELCOME_MESSAGE = 'Hello! I\'m InternBot 🤖 I can help you discover the right experts across your organization. Try asking me about specific technologies, projects, or skills!';

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function sessionKeyForUser(employeeId?: string): string {
  return employeeId ? `${SESSION_KEY}:${employeeId}` : SESSION_KEY;
}

function getOrCreateSessionId(employeeId?: string): string {
  const storageKey = sessionKeyForUser(employeeId);
  const stored = localStorage.getItem(storageKey);
  if (stored) return stored;
  const newId = generateSessionId();
  localStorage.setItem(storageKey, newId);
  return newId;
}

function storeSessionId(sessionId: string, employeeId?: string): void {
  localStorage.setItem(sessionKeyForUser(employeeId), sessionId);
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

function normaliseRecommendationStates(
  rawStates?: Record<string, RecommendationNotificationState>
): Record<number, RecommendationNotificationState> {
  if (!rawStates) return {};

  return Object.entries(rawStates).reduce<Record<number, RecommendationNotificationState>>(
    (states, [recommendationId, state]) => {
      const numericRecommendationId = Number(recommendationId);
      if (!Number.isFinite(numericRecommendationId)) return states;

      const feedbackIsDue = (
        state.status === 'sent'
        && !state.feedbackSubmitted
        && millisecondsUntil(state.feedbackAvailableAt) === 0
      );
      states[numericRecommendationId] = {
        ...state,
        feedbackPromptVisible: Boolean(state.feedbackPromptVisible || feedbackIsDue),
      };
      return states;
    },
    {}
  );
}

function millisecondsUntil(timestamp?: string | null): number {
  if (!timestamp) return 120000;
  const parsed = new Date(timestamp).getTime();
  if (Number.isNaN(parsed)) return 120000;
  return Math.max(0, parsed - Date.now());
}

// ---------- Provider ----------

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const employeeId = user?.employee_id;
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'bot',
      content: WELCOME_MESSAGE,
      timestamp: new Date(),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [sessionId, setSessionId] = useState(() => getOrCreateSessionId(employeeId));
  const inFlightRef = useRef(false);
  const feedbackTimersRef = useRef<Record<string, ReturnType<typeof window.setTimeout>>>({});

  // Check backend availability on mount
  useEffect(() => {
    healthApi.isAvailable().then(setBackendAvailable);
  }, []);

  useEffect(() => {
    const userSessionId = getOrCreateSessionId(employeeId);
    Object.values(feedbackTimersRef.current).forEach(window.clearTimeout);
    feedbackTimersRef.current = {};
    setSessionId(userSessionId);
    setMessages([
      {
        id: 'welcome',
        role: 'bot',
        content: WELCOME_MESSAGE,
        timestamp: new Date(),
      },
    ]);
    setRecommendations([]);
  }, [employeeId]);

  useEffect(() => () => {
    Object.values(feedbackTimersRef.current).forEach(window.clearTimeout);
    feedbackTimersRef.current = {};
  }, []);

  const showFeedbackPrompt = useCallback((messageId: string, recommendationId: number) => {
    setMessages(prev => prev.map(message =>
      message.id === messageId
        ? {
            ...message,
            recommendationStates: {
              ...message.recommendationStates,
              [recommendationId]: {
                ...(message.recommendationStates?.[recommendationId] ?? { status: 'sent' }),
                feedbackPromptVisible: true,
                feedbackStatus: 'idle',
              },
            },
          }
        : message
    ));
  }, []);

  const scheduleFeedbackPrompt = useCallback((
    messageId: string,
    recommendationId: number,
    feedbackAvailableAt?: string | null
  ) => {
    const timerKey = `${messageId}:${recommendationId}`;
    if (feedbackTimersRef.current[timerKey]) {
      window.clearTimeout(feedbackTimersRef.current[timerKey]);
    }

    const delayMs = millisecondsUntil(feedbackAvailableAt);
    feedbackTimersRef.current[timerKey] = window.setTimeout(() => {
      delete feedbackTimersRef.current[timerKey];
      showFeedbackPrompt(messageId, recommendationId);
    }, delayMs);
  }, [showFeedbackPrompt]);

  // Restore chat history from backend on mount
  useEffect(() => {
    if (backendAvailable !== true) return;

    chatApi.getHistory(sessionId)
      .then(history => {
        if (!history || history.length === 0) return;

        Object.values(feedbackTimersRef.current).forEach(window.clearTimeout);
        feedbackTimersRef.current = {};

        const restoredMessages: Message[] = [
          {
            id: 'welcome',
            role: 'bot',
            content: WELCOME_MESSAGE,
            timestamp: new Date(),
          },
        ];
        const timersToSchedule: Array<{
          messageId: string;
          recommendationId: number;
          feedbackAvailableAt?: string | null;
        }> = [];

        for (const entry of history) {
          const botMessageId = `restored-bot-${entry.id}`;
          const restoredRecommendations = entry.recommendations ?? [];
          const restoredRecommendationStates = normaliseRecommendationStates(entry.recommendation_states);

          restoredMessages.push({
            id: `restored-user-${entry.id}`,
            role: 'user',
            content: entry.message,
            timestamp: new Date(entry.created_at),
          });
          restoredMessages.push({
            id: botMessageId,
            role: 'bot',
            content: entry.bot_response,
            recommendations: restoredRecommendations,
            domain: entry.detected_topic ?? undefined,
            confirmationRequired: Boolean(entry.confirmation_required),
            recommendationStates: Object.keys(restoredRecommendationStates).length > 0
              ? restoredRecommendationStates
              : createRecommendationStates(restoredRecommendations),
            timestamp: new Date(entry.created_at),
          });

          for (const [recommendationId, state] of Object.entries(restoredRecommendationStates)) {
            if (
              state.status === 'sent'
              && state.feedbackAvailableAt
              && !state.feedbackPromptVisible
              && !state.feedbackSubmitted
            ) {
              timersToSchedule.push({
                messageId: botMessageId,
                recommendationId: Number(recommendationId),
                feedbackAvailableAt: state.feedbackAvailableAt,
              });
            }
          }
        }

        setMessages(restoredMessages);
        timersToSchedule.forEach(timer => {
          scheduleFeedbackPrompt(timer.messageId, timer.recommendationId, timer.feedbackAvailableAt);
        });
      })
      .catch(() => {
        // Silently ignore restore errors
      });
  }, [backendAvailable, scheduleFeedbackPrompt, sessionId]);

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
        storeSessionId(response.session_id, employeeId);
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
  }, [backendAvailable, sessionId, employeeId]);

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
      const statusMessage = response.contact_request.direct_message
        ? 'Chat message sent. The conversation is now available in direct messages.'
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
                  feedbackAvailableAt: response.contact_request.feedback_available_at,
                  feedbackPromptVisible: millisecondsUntil(response.contact_request.feedback_available_at) === 0,
                  feedbackStatus: 'idle',
                },
              },
            }
          : message
      ));
      scheduleFeedbackPrompt(
        messageId,
        recommendationId,
        response.contact_request.feedback_available_at
      );
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
                  message: 'I could not send the chat message. Please try again.',
                },
              },
            }
          : message
      ));
    }
  }, [scheduleFeedbackPrompt]);

  const submitRecommendationFeedback = useCallback(async (
    messageId: string,
    recommendationId: number,
    feedback: Omit<FeedbackRequest, 'recommendation_id' | 'contact_request_id'>
  ) => {
    const contactRequestId = messages.find(message => message.id === messageId)
      ?.recommendationStates?.[recommendationId]
      ?.contactRequestId;

    setMessages(prev => prev.map(message => {
      if (message.id !== messageId) return message;
      return {
        ...message,
        recommendationStates: {
          ...message.recommendationStates,
          [recommendationId]: {
            ...(message.recommendationStates?.[recommendationId] ?? { status: 'sent' }),
            feedbackStatus: 'sending',
            feedbackMessage: undefined,
          },
        },
      };
    }));

    try {
      if (!contactRequestId) {
        throw new Error('Missing contact request for feedback.');
      }

      await chatApi.submitFeedback({
        contact_request_id: contactRequestId,
        ...feedback,
      });

      setMessages(prev => prev.map(message =>
        message.id === messageId
          ? {
              ...message,
              recommendationStates: {
                ...message.recommendationStates,
                [recommendationId]: {
                  ...(message.recommendationStates?.[recommendationId] ?? { status: 'sent' }),
                  feedbackPromptVisible: false,
                  feedbackSubmitted: true,
                  feedbackStatus: 'sent',
                  feedbackMessage: 'Thanks. Sandy will use this feedback for future routing.',
                },
              },
            }
          : message
      ));
    } catch (error) {
      console.warn('[ChatContext] Recommendation feedback failed:', error);
      setMessages(prev => prev.map(message =>
        message.id === messageId
          ? {
              ...message,
              recommendationStates: {
                ...message.recommendationStates,
                [recommendationId]: {
                  ...(message.recommendationStates?.[recommendationId] ?? { status: 'sent' }),
                  feedbackStatus: 'error',
                  feedbackMessage: 'I could not save that feedback. Please try again.',
                },
              },
            }
          : message
      ));
    }
  }, [messages]);

  const clearChat = useCallback(() => {
    const newSessionId = generateSessionId();
    storeSessionId(newSessionId, employeeId);
    setSessionId(newSessionId);
    setMessages([
      {
        id: 'welcome',
        role: 'bot',
        content: WELCOME_MESSAGE,
        timestamp: new Date(),
      },
    ]);
    setRecommendations([]);
  }, [employeeId]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        sessionId,
        isTyping,
        recommendations,
        sendMessage,
        confirmRecommendation,
        submitRecommendationFeedback,
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
