import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  LogOut,
  Bell,
  Bot,
  CheckCircle2,
  Code,
  Lightbulb,
  Loader2,
  Mail,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import { employeeApi, messageApi, notificationApi, type DirectMessage } from '@/services/api';
import type { Message, Notification, RecommendationItem, RecommendationNotificationState, Employee, ActiveConversation } from '@/types';
import ProfileModal from '@/components/ProfileModal';

const suggestionChips = [
  { icon: Search, text: 'Find React experts' },
  { icon: Users, text: 'Who knows AWS?' },
  { icon: Code, text: 'Python mentors' },
  { icon: Lightbulb, text: 'ML project leads' },
];

const workspaceSections = [
  {
    label: 'Capabilities',
    items: ['Skill discovery', 'Project staffing', 'Mentorship matching'],
  },
  {
    label: 'Signals',
    items: ['Live recommendations', 'Contact confirmations', 'Fallback demo mode'],
  },
];

function formatMessageContent(content: string) {
  return content.split(/(\*\*.*?\*\*)/).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={`${part}-${index}`} className="font-semibold text-white">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function formatTime(timestamp: Date) {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${diffDays}d ago`;
}

function recentUserPrompts(messages: Message[]) {
  const prompts: string[] = [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role !== 'user') continue;
    if (prompts.includes(message.content)) continue;

    prompts.push(message.content);

    if (prompts.length === 4) break;
  }

  return prompts;
}

function RecommendationCard({
  recommendation,
  canNotify,
  notificationState,
  onNotify,
  onFeedbackSubmit,
}: {
  recommendation: RecommendationItem;
  canNotify: boolean;
  notificationState?: RecommendationNotificationState;
  onNotify: () => void;
  onFeedbackSubmit: (feedback: { was_useful: boolean; rating: number; feedback_text?: string }) => void;
}) {
  const notificationStatus = notificationState?.status;
  const notificationMessage = notificationState?.message;
  const feedbackVisible = Boolean(notificationState?.feedbackPromptVisible && !notificationState.feedbackSubmitted);
  const feedbackStatus = notificationState?.feedbackStatus;
  const feedbackMessage = notificationState?.feedbackMessage;
  const [wasUseful, setWasUseful] = useState<boolean | null>(null);
  const [rating, setRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');

  const handleFeedbackSubmit = () => {
    if (wasUseful === null || feedbackStatus === 'sending') return;
    onFeedbackSubmit({
      was_useful: wasUseful,
      rating,
      feedback_text: feedbackText.trim() || undefined,
    });
  };

  return (
    <div className="rounded-3xl border border-white/8 bg-[#1d1d1d] p-4 text-sm text-zinc-300 shadow-[0_18px_50px_-28px_rgba(0,0,0,0.8)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-white">{recommendation.name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.28em] text-zinc-500">
            {recommendation.designation} · {recommendation.department}
          </p>
        </div>
        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
          {recommendation.level}
        </span>
      </div>

      <p className="mt-4 leading-6 text-zinc-400">{recommendation.reason}</p>

      {recommendation.top_skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {recommendation.top_skills.map((skill) => (
            <span
              key={`${recommendation.employee_id}-${skill.name}`}
              className="rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs text-zinc-300"
            >
              {skill.name} · {skill.proficiency}/5
            </span>
          ))}
        </div>
      )}

      {canNotify && notificationStatus !== 'sent' && (
        <div className="mt-4 rounded-2xl border border-emerald-500/12 bg-emerald-500/[0.05] p-3">
          <p className="text-xs leading-5 text-zinc-300">
            Send this expert a direct chat message that you may contact them.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="h-8 rounded-full bg-white px-3 text-xs font-semibold text-black hover:bg-zinc-200 disabled:opacity-60"
              disabled={notificationStatus === 'sending'}
              onClick={onNotify}
            >
              {notificationStatus === 'sending' ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="mr-1.5 h-3.5 w-3.5" />
              )}
              {notificationStatus === 'sending' ? 'Sending...' : 'Send chat message'}
            </Button>
            {notificationStatus === 'error' && notificationMessage && (
              <span className="inline-flex items-center text-xs text-amber-300">
                <AlertCircle className="mr-1 h-3.5 w-3.5" />
                {notificationMessage}
              </span>
            )}
          </div>
        </div>
      )}

      {notificationStatus === 'sent' && notificationMessage && (
        <div className="mt-4 space-y-3">
          <div className="inline-flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-2 text-xs text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{notificationMessage}</span>
          </div>
          {!feedbackVisible && !notificationState?.feedbackSubmitted && (
            <p className="text-xs text-zinc-500">
              Sandy will ask for feedback on this recommendation in about 2 minutes.
            </p>
          )}
        </div>
      )}

      {feedbackVisible && (
        <div className="mt-4 rounded-2xl border border-sky-500/15 bg-sky-500/[0.05] p-3">
          <p className="text-xs font-medium text-sky-100">
            Did this recommendation help solve your query?
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              className={`h-8 rounded-full border px-3 text-xs ${
                wasUseful === true
                  ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
                  : 'border-white/8 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]'
              }`}
              onClick={() => setWasUseful(true)}
            >
              Yes
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={`h-8 rounded-full border px-3 text-xs ${
                wasUseful === false
                  ? 'border-amber-500/30 bg-amber-500/15 text-amber-200'
                  : 'border-white/8 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]'
              }`}
              onClick={() => setWasUseful(false)}
            >
              Not really
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className={`h-7 w-7 rounded-full border text-xs transition-colors ${
                  rating === value
                    ? 'border-sky-400/40 bg-sky-400/15 text-sky-100'
                    : 'border-white/8 bg-white/[0.03] text-zinc-400 hover:text-white'
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          <textarea
            value={feedbackText}
            onChange={(event) => setFeedbackText(event.target.value)}
            placeholder="Optional note"
            rows={2}
            className="mt-3 w-full resize-none rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-sky-400/30"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="h-8 rounded-full bg-white px-3 text-xs font-semibold text-black hover:bg-zinc-200 disabled:opacity-60"
              disabled={wasUseful === null || feedbackStatus === 'sending'}
              onClick={handleFeedbackSubmit}
            >
              {feedbackStatus === 'sending' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Submit feedback
            </Button>
            {feedbackStatus === 'error' && feedbackMessage && (
              <span className="inline-flex items-center text-xs text-amber-300">
                <AlertCircle className="mr-1 h-3.5 w-3.5" />
                {feedbackMessage}
              </span>
            )}
          </div>
        </div>
      )}

      {notificationState?.feedbackSubmitted && feedbackMessage && (
        <div className="mt-4 inline-flex items-start gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/[0.08] px-3 py-2 text-xs text-sky-100">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}
    </div>
  );
}

// ==================== Notification Panel ====================

function NotificationPanel({
  notifications,
  onMarkRead,
  onClose,
}: {
  notifications: Notification[];
  onMarkRead: (id: number) => void;
  onClose: () => void;
}) {
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="absolute top-0 right-0 z-50 flex h-full w-full max-w-[400px] flex-col border-l border-white/8 bg-[#111112]/95 backdrop-blur-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-emerald-400" />
          <h3 className="text-base font-semibold text-white">Notifications</h3>
          {unreadCount > 0 && (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
              {unreadCount} new
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-14 w-14 rounded-full bg-white/[0.03] flex items-center justify-center mb-4 border border-white/10">
              <Bell className="h-6 w-6 text-zinc-500" />
            </div>
            <h4 className="text-sm font-medium text-zinc-300 mb-1">No notifications yet</h4>
            <p className="text-xs text-zinc-500 max-w-[240px]">
              You'll see notifications here when someone wants to connect with you.
            </p>
          </div>
        ) : (
          notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border p-4 transition-colors ${
                notif.read_at
                  ? 'border-white/4 bg-white/[0.01]'
                  : 'border-emerald-500/15 bg-emerald-500/[0.03]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {!notif.read_at && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{notif.topic}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {notif.requester_name || notif.requester_id ? `From: ${notif.requester_name || notif.requester_id}` : 'Contact request'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {notif.channel === 'chat' ? 'Chat message' : 'Notification'} · {formatRelativeTime(notif.created_at)}
                    </p>
                  </div>
                </div>
                {!notif.read_at && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 rounded-full border border-white/8 bg-white/[0.03] px-2.5 text-[11px] text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                    onClick={() => onMarkRead(notif.id)}
                  >
                    Mark read
                  </Button>
                )}
              </div>
              {notif.read_at && (
                <div className="mt-2 flex items-center gap-1 text-[11px] text-zinc-600">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Read</span>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}

// ==================== Main ChatPage ====================

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const {
    messages,
    isTyping,
    sendMessage,
    confirmRecommendation,
    submitRecommendationFeedback,
    clearChat,
    backendAvailable,
  } = useChatContext();
  const [inputValue, setInputValue] = useState('');
  const messageViewportRef = useRef<HTMLDivElement>(null);
  const sidebarViewportRef = useRef<HTMLDivElement>(null);
  const activeChatRef = useRef('bot');
  const initialScrollEffectRef = useRef(true);
  const messageRequestRef = useRef(0);
  const forceNextScrollRef = useRef(false);
  
  const [activeChat, setActiveChat] = useState<string>('bot');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [directMessagesLoading, setDirectMessagesLoading] = useState(false);
  const [directMessageError, setDirectMessageError] = useState('');
  const [isSendingDirectMessage, setIsSendingDirectMessage] = useState(false);

  // Notification state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);

  const unreadNotificationCount = notifications.filter((n) => !n.read_at).length;

  // Profile modal and Live chat states
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeConversations, setActiveConversations] = useState<Record<string, ActiveConversation>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [toasts, setToasts] = useState<{ id: string; senderId: string; senderName: string; message: string; timestamp: Date }[]>([]);
  const prevConversationsRef = useRef<Record<string, ActiveConversation>>({});

  const isNearBottom = useCallback(() => {
    const viewport = messageViewportRef.current;
    if (!viewport) return true;
    return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 120;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const viewport = messageViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
  }, []);

  // Fetch employees (exclude logged-in user)
  useEffect(() => {
    let cancelled = false;
    employeeApi.list({ limit: 100 })
      .then(data => {
        if (!cancelled && user) {
          setEmployees(data.filter(emp => emp.employee_id !== user.employee_id));
        }
      })
      .catch(() => {
        if (!cancelled) setEmployees([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const fetchConversationsAndUnread = useCallback(async (isInitial = false) => {
    try {
      const [convData, unreadData] = await Promise.all([
        messageApi.getActiveConversations(),
        messageApi.getUnreadCounts()
      ]);
      
      setActiveConversations(convData);
      setUnreadCounts(unreadData);
      
      // If this is not the initial load, check for new incoming messages to show notifications
      if (!isInitial) {
        Object.entries(convData).forEach(([colleagueId, conv]) => {
          const prevConv = prevConversationsRef.current[colleagueId];
          const isNewMessage = !prevConv || prevConv.timestamp !== conv.timestamp;
          
          if (isNewMessage && conv.sender_id === colleagueId && colleagueId !== activeChatRef.current) {
            const sender = employees.find(e => e.employee_id === colleagueId);
            const senderName = sender ? sender.name : 'Someone';
            
            // Show toast notification
            setToasts(prev => [
              ...prev,
              {
                id: Math.random().toString(36).substr(2, 9),
                senderId: colleagueId,
                senderName,
                message: conv.last_message,
                timestamp: new Date()
              }
            ]);
          }
        });
      }
      
      prevConversationsRef.current = convData;
    } catch (error) {
      console.error("Failed to fetch conversations and unread counts", error);
    }
  }, [employees]);

  // Poll conversations and unread counts
  useEffect(() => {
    if (employees.length === 0) return;
    
    // Fetch immediately
    void fetchConversationsAndUnread(true);
    
    const interval = setInterval(() => {
      void fetchConversationsAndUnread(false);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [employees, fetchConversationsAndUnread]);

  // Auto-dismiss toast notifications sequentially
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 5000);
    return () => clearTimeout(timer);
  }, [toasts]);

  // Fetch notifications on mount + poll every 30s
  useEffect(() => {
    let cancelled = false;
    const fetchNotifications = () => {
      notificationApi.list()
        .then(data => {
          if (!cancelled) setNotifications(data);
        })
        .catch(() => {
          // Silently ignore notification fetch errors
        });
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // DM polling: fetch new messages every 5 seconds when in a DM conversation
  useEffect(() => {
    if (activeChat === 'bot') return;
    const recipientId = activeChat;

    const pollMessages = () => {
      messageApi.getMessages(recipientId)
        .then(data => {
          if (activeChatRef.current === recipientId) {
            setDirectMessages(prev => {
              // Only update if there are new messages
              if (data.length !== prev.length) return data;
              // Check if last message ID differs
              if (data.length > 0 && prev.length > 0 && data[data.length - 1].id !== prev[prev.length - 1].id) {
                return data;
              }
              return prev;
            });
          }
        })
        .catch(() => {
          // Silently ignore poll errors
        });
    };

    const interval = setInterval(pollMessages, 5000);
    return () => clearInterval(interval);
  }, [activeChat]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      sidebarViewportRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      messageViewportRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (activeChatRef.current === activeChat) {
      return;
    }
    activeChatRef.current = activeChat;
    setInputValue('');
    setDirectMessageError('');
    forceNextScrollRef.current = true;

    if (activeChat === 'bot') {
      setDirectMessages([]);
      setDirectMessagesLoading(false);
      requestAnimationFrame(() => scrollToBottom('auto'));
      return;
    }

    // Instantly clear unread state for the active conversation
    setUnreadCounts(prev => ({
      ...prev,
      [activeChat]: 0
    }));
    setActiveConversations(prev => {
      if (!prev[activeChat]) return prev;
      return {
        ...prev,
        [activeChat]: {
          ...prev[activeChat],
          read: true
        }
      };
    });

    const requestId = ++messageRequestRef.current;
    setDirectMessages([]);
    setDirectMessagesLoading(true);
    messageApi.getMessages(activeChat)
      .then(data => {
        if (requestId === messageRequestRef.current) setDirectMessages(data);
      })
      .catch(() => {
        if (requestId === messageRequestRef.current) {
          setDirectMessageError('Could not load this conversation. Please try again.');
        }
      })
      .finally(() => {
        if (requestId === messageRequestRef.current) setDirectMessagesLoading(false);
      });
  }, [activeChat, scrollToBottom]);

  useEffect(() => {
    if (initialScrollEffectRef.current) {
      initialScrollEffectRef.current = false;
      return;
    }
    if (!forceNextScrollRef.current && messages.length <= 1 && directMessages.length === 0) {
      return;
    }
    if (forceNextScrollRef.current || isNearBottom()) {
      requestAnimationFrame(() => scrollToBottom(forceNextScrollRef.current ? 'auto' : 'smooth'));
      forceNextScrollRef.current = false;
    }
  }, [messages, directMessages, isNearBottom, scrollToBottom]);

  const handleSendMessage = async (text?: string) => {
    const messageText = text ?? inputValue.trim();

    if (!messageText || (activeChat === 'bot' ? isTyping : isSendingDirectMessage)) return;

    forceNextScrollRef.current = true;
    setInputValue('');
    if (activeChat === 'bot') {
      await sendMessage(messageText);
    } else {
      const recipientId = activeChat;
      setIsSendingDirectMessage(true);
      setDirectMessageError('');
      try {
        const newMsg = await messageApi.sendMessage(recipientId, messageText);
        if (activeChatRef.current === recipientId) {
          setDirectMessages(prev => [...prev, newMsg]);
          
          // Update local conversations state immediately so they move to the top
          setActiveConversations(prev => ({
            ...prev,
            [recipientId]: {
              last_message: messageText,
              timestamp: newMsg.timestamp,
              sender_id: user?.employee_id || '',
              read: true
            }
          }));
        }
      } catch {
        if (activeChatRef.current === recipientId) {
          setInputValue(messageText);
          setDirectMessageError('Message was not sent. Check your connection and try again.');
        }
      } finally {
        setIsSendingDirectMessage(false);
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.repeat && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  const handleMarkNotificationRead = (notificationId: number) => {
    notificationApi.markRead(notificationId)
      .then(() => {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n)
        );
      })
      .catch(() => {
        // Silently fail
      });
  };

  const isSending = activeChat === 'bot' ? isTyping : isSendingDirectMessage;

  const promptHistory = recentUserPrompts(messages);
  const showEmptyState = messages.length <= 1 && !isTyping;
  const renderedMessages = showEmptyState
    ? messages.filter((message) => message.id !== 'welcome')
    : messages;

  // Get active DM recipient info
  const activeDmRecipient = activeChat !== 'bot'
    ? employees.find(e => e.employee_id === activeChat)
    : null;

  const chatTitle = activeChat === 'bot'
    ? 'Chat with InternBot'
    : activeDmRecipient
      ? `Chat with ${activeDmRecipient.name}`
      : 'Direct Message';

  const chatSubtitle = activeChat === 'bot'
    ? 'Talent intelligence'
    : activeDmRecipient
      ? `${activeDmRecipient.role || activeDmRecipient.department || 'Employee'}`
      : '';

  const inputPlaceholder = activeChat === 'bot'
    ? 'Ask InternBot about skills, teams, or who can help next...'
    : activeDmRecipient
      ? `Message ${activeDmRecipient.name}...`
      : 'Type a message...';

  // Sort employees: those with active conversations on top (latest first), then alphabetical
  const sortedEmployees = [...employees].sort((a, b) => {
    const convA = activeConversations[a.employee_id];
    const convB = activeConversations[b.employee_id];
    
    if (convA && convB) {
      return new Date(convB.timestamp).getTime() - new Date(convA.timestamp).getTime();
    }
    if (convA) return -1;
    if (convB) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="relative h-dvh overflow-hidden bg-[#0b0b0c] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(78,87,255,0.14),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.10),_transparent_26%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_16%,transparent_84%,rgba(255,255,255,0.02))]" />

      <div className="relative flex h-full min-h-0 flex-col md:flex-row">
        <aside className="flex max-h-[38dvh] w-full shrink-0 flex-col border-b border-white/6 bg-[#111112]/90 backdrop-blur-2xl md:max-h-none md:h-full md:w-[290px] md:border-b-0 md:border-r">
          <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-4 md:px-5 md:py-6">
            <Button
              variant="ghost"
              className="h-10 rounded-2xl border border-white/8 bg-white/[0.03] px-3 text-zinc-200 hover:bg-white/[0.06]"
              onClick={() => {
                logout();
                navigate('/signin');
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-2xl border border-white/8 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]"
              onClick={clearChat}
              title="Clear chat"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <div ref={sidebarViewportRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 [scrollbar-gutter:stable] md:px-5">
            <div className="mt-2">
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 mb-3 px-2">AI Assistant</p>
              <div
                onClick={() => setActiveChat('bot')}
                className={`rounded-[24px] border p-3 cursor-pointer transition-colors ${
                  activeChat === 'bot'
                    ? 'border-emerald-500/30 bg-emerald-500/[0.05] shadow-[0_20px_50px_-35px_rgba(0,0,0,0.85)]'
                    : 'border-white/4 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-emerald-500/20 bg-emerald-950/40">
                    <AvatarFallback className="bg-transparent text-emerald-400">
                      <Bot className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-sm font-semibold tracking-tight text-white">
                      InternBot
                    </h1>
                    <p className="text-xs text-emerald-400/80 truncate">
                      Expert discovery & intelligence
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 mb-3 px-2">Direct Messages</p>
              <div className="space-y-2">
                {sortedEmployees.map((emp) => {
                  const conv = activeConversations[emp.employee_id];
                  const unreadCount = unreadCounts[emp.employee_id] || 0;
                  return (
                    <div
                      key={emp.employee_id}
                      onClick={() => setActiveChat(emp.employee_id)}
                      className={`rounded-[24px] border p-3 cursor-pointer transition-colors ${
                        activeChat === emp.employee_id
                          ? 'border-emerald-500/30 bg-emerald-500/[0.05]'
                          : 'border-white/4 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-white/10 bg-[#1d1d1f]">
                          <AvatarFallback className="bg-transparent text-zinc-300 text-sm">
                            {emp.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h1 className="text-sm font-medium tracking-tight text-zinc-200 truncate">
                              {emp.name}
                            </h1>
                            {conv && (
                              <span className="text-[10px] text-zinc-500 shrink-0">
                                {formatRelativeTime(conv.timestamp)}
                              </span>
                            )}
                          </div>
                          <p className={`text-xs truncate ${unreadCount > 0 ? 'text-zinc-200 font-semibold font-bold' : 'text-zinc-500'}`}>
                            {conv ? conv.last_message : (emp.role || emp.department)}
                          </p>
                        </div>
                        {unreadCount > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-black shrink-0">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 rounded-[28px] border border-white/8 bg-[#151516] p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Session</p>
                {backendAvailable !== null && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      backendAvailable
                        ? 'bg-emerald-500/12 text-emerald-300'
                        : 'bg-amber-500/12 text-amber-300'
                    }`}
                  >
                    {backendAvailable ? 'API connected' : 'Demo mode'}
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {workspaceSections.map((section) => (
                  <div key={section.label} className="rounded-2xl border border-white/6 bg-black/20 p-3">
                    <p className="text-sm font-medium text-white">{section.label}</p>
                    <div className="mt-3 space-y-2">
                      {section.items.map((item) => (
                        <div key={item} className="flex items-start gap-2 text-sm text-zinc-400">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-500" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 hidden min-h-0 flex-shrink-0 flex-col md:flex">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Recent prompts</p>
                <span className="rounded-full border border-white/8 px-2 py-1 text-[11px] text-zinc-500">
                  {promptHistory.length}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {promptHistory.length > 0 ? (
                  promptHistory.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="w-full rounded-2xl border border-white/6 bg-white/[0.02] px-3 py-3 text-left text-sm text-zinc-300 transition hover:border-white/12 hover:bg-white/[0.05]"
                      onClick={() => handleSendMessage(prompt)}
                    >
                      {prompt}
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-sm leading-6 text-zinc-500">
                    Your last searches will appear here once you start chatting.
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Pinned User Profile Card */}
          <div className="flex-shrink-0 border-t border-white/6 px-4 py-4 md:px-5">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/4 bg-white/[0.01] p-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-9 w-9 border border-emerald-500/20 bg-emerald-950/40">
                  <AvatarFallback className="bg-transparent text-emerald-400 text-xs font-semibold">
                    {user?.name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{user?.role || user?.department || 'My Profile'}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 text-xs text-zinc-300 hover:bg-white/[0.06] shrink-0"
                onClick={() => setIsProfileOpen(true)}
              >
                Profile
              </Button>
            </div>
          </div>
        </aside>

        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="border-b border-white/6 bg-[#121213]/70 px-4 py-4 backdrop-blur-xl md:px-6">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">
                  {activeChat === 'bot' ? 'AI Chat Workspace' : 'Direct Message'}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight text-white">{chatTitle}</h2>
                  <span className="inline-flex items-center rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs text-zinc-400">
                    {activeChat === 'bot' ? (
                      <>
                        <Sparkles className="mr-1.5 h-3.5 w-3.5 text-violet-300" />
                        {chatSubtitle}
                      </>
                    ) : (
                      <>
                        <User className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                        {chatSubtitle}
                      </>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Notification Bell */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative rounded-2xl border border-white/8 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                  onClick={() => setNotificationPanelOpen(!notificationPanelOpen)}
                  title="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-black">
                      {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                    </span>
                  )}
                </Button>

                <div className="hidden items-center gap-2 md:flex">
                  <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
                    Suggestions stay interactive
                  </span>
                  <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
                    Contact approvals included
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 px-3 py-3 md:px-6 md:py-5">
            <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-white/8 bg-[#171718]/88 shadow-[0_30px_120px_-45px_rgba(0,0,0,0.9)]">
              <div
                ref={messageViewportRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain [overflow-anchor:none] [scrollbar-gutter:stable]"
                aria-live="polite"
              >
                <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
                  {activeChat === 'bot' ? (
                    <>
                      {showEmptyState && (
                        <section className="flex min-h-[52vh] flex-col items-center justify-center text-center">
                          <h3 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                            Ask one question and surface the right expert fast.
                          </h3>
                          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
                            Search by technology, project context, mentorship needs, or domain expertise.
                            InternBot keeps the conversation grounded in your team directory.
                          </p>

                          <div className="mt-10 grid w-full max-w-3xl gap-3 md:grid-cols-2">
                            {suggestionChips.map((chip) => {
                              const Icon = chip.icon;

                              return (
                                <button
                                  key={chip.text}
                                  type="button"
                                  className="group rounded-[28px] border border-white/8 bg-[#1c1c1d] p-4 text-left transition hover:-translate-y-0.5 hover:border-white/16 hover:bg-[#222224]"
                                  onClick={() => handleSendMessage(chip.text)}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm uppercase tracking-[0.24em] text-zinc-500">
                                        Quick prompt
                                      </p>
                                      <p className="mt-4 text-lg font-medium text-white">{chip.text}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-300 transition group-hover:text-white">
                                      <Icon className="h-4 w-4" />
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      )}

                      {renderedMessages.map((message) => {
                        const isUser = message.role === 'user';

                        return (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.28, ease: 'easeOut' }}
                            className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`flex w-full gap-4 ${isUser ? 'max-w-2xl flex-row-reverse' : 'max-w-3xl'}`}>
                              <Avatar
                                className={`mt-1 h-9 w-9 shrink-0 border ${
                                  isUser
                                    ? 'border-white/10 bg-[#232325]'
                                    : 'border-emerald-500/20 bg-emerald-500/[0.08]'
                                }`}
                              >
                                <AvatarFallback className="bg-transparent text-zinc-100">
                                  {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                                </AvatarFallback>
                              </Avatar>

                              <div className="min-w-0 flex-1">
                                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
                                  <span>{isUser ? 'You' : 'InternBot'}</span>
                                  <span className="h-1 w-1 rounded-full bg-zinc-600" />
                                  <span>{formatTime(message.timestamp)}</span>
                                </div>

                                <div
                                  className={`rounded-[28px] border px-5 py-4 shadow-[0_24px_70px_-42px_rgba(0,0,0,0.85)] ${
                                    isUser
                                      ? 'border-violet-400/15 bg-[linear-gradient(145deg,rgba(99,102,241,0.22),rgba(35,35,38,0.95))] text-zinc-100'
                                      : 'border-white/8 bg-[#1b1b1d] text-zinc-300'
                                  }`}
                                >
                                  <div className="whitespace-pre-wrap text-[15px] leading-7">
                                    {formatMessageContent(message.content)}
                                  </div>

                                  {!isUser && message.confirmationPrompt && (
                                    <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-3 text-sm leading-6 text-zinc-400">
                                      {message.confirmationPrompt}
                                    </div>
                                  )}
                                </div>

                                {!isUser && message.recommendations && message.recommendations.length > 0 && (
                                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                                    {message.recommendations.map((recommendation, index) => {
                                      const recommendationId = recommendation.recommendation_id;
                                      const notificationState =
                                        recommendationId !== undefined
                                          ? message.recommendationStates?.[recommendationId]
                                          : undefined;

                                      return (
                                        <RecommendationCard
                                          key={`${message.id}-${recommendation.employee_id}-${index}`}
                                          recommendation={recommendation}
                                          canNotify={recommendationId !== undefined}
                                          notificationState={notificationState}
                                          onNotify={() => {
                                            if (recommendationId !== undefined) {
                                              confirmRecommendation(message.id, recommendationId);
                                            }
                                          }}
                                          onFeedbackSubmit={(feedback) => {
                                            if (recommendationId !== undefined) {
                                              submitRecommendationFeedback(message.id, recommendationId, feedback);
                                            }
                                          }}
                                        />
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      {directMessagesLoading ? (
                        <div className="flex min-h-[40vh] items-center justify-center text-zinc-400">
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading conversation...
                        </div>
                      ) : directMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
                          <div className="h-16 w-16 rounded-full bg-white/[0.03] flex items-center justify-center mb-4 border border-white/10">
                            <Mail className="h-8 w-8 text-zinc-500" />
                          </div>
                          <h3 className="text-xl font-medium text-white mb-2">No messages yet</h3>
                          <p className="text-zinc-400 text-sm">Send a message to start the conversation.</p>
                        </div>
                      ) : (
                        directMessages.map((msg) => {
                          const isUser = msg.sender_id === user?.employee_id;
                          const senderEmployee = !isUser ? employees.find(e => e.employee_id === msg.sender_id) : null;
                          return (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.28, ease: 'easeOut' }}
                              className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`flex w-full gap-4 ${isUser ? 'max-w-2xl flex-row-reverse' : 'max-w-3xl'}`}>
                                <Avatar
                                  className={`mt-1 h-9 w-9 shrink-0 border border-white/10 ${
                                    isUser ? 'bg-[#232325]' : 'bg-[#1d1d1f]'
                                  }`}
                                >
                                  <AvatarFallback className="bg-transparent text-zinc-100 text-sm">
                                    {isUser
                                      ? (user?.name?.charAt(0) || <User className="h-4 w-4" />)
                                      : (senderEmployee?.name?.charAt(0) || <User className="h-4 w-4" />)
                                    }
                                  </AvatarFallback>
                                </Avatar>

                                <div className="min-w-0 flex-1">
                                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
                                    <span>{isUser ? 'You' : (senderEmployee?.name || 'Colleague')}</span>
                                    <span className="h-1 w-1 rounded-full bg-zinc-600" />
                                    <span>{formatTime(new Date(msg.timestamp))}</span>
                                  </div>

                                  <div
                                    className={`rounded-[28px] border px-5 py-4 shadow-[0_24px_70px_-42px_rgba(0,0,0,0.85)] ${
                                      isUser
                                        ? 'border-violet-400/15 bg-[linear-gradient(145deg,rgba(99,102,241,0.22),rgba(35,35,38,0.95))] text-zinc-100'
                                        : 'border-white/8 bg-[#1b1b1d] text-zinc-300'
                                    }`}
                                  >
                                    <div className="whitespace-pre-wrap text-[15px] leading-7">
                                      {msg.message}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </>
                  )}

                  {isTyping && activeChat === 'bot' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex w-full justify-start"
                    >
                      <div className="flex max-w-3xl gap-4">
                        <Avatar className="mt-1 h-9 w-9 border border-emerald-500/20 bg-emerald-500/[0.08]">
                          <AvatarFallback className="bg-transparent text-zinc-100">
                            <Bot className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="rounded-[28px] border border-white/8 bg-[#1b1b1d] px-5 py-4 shadow-[0_24px_70px_-42px_rgba(0,0,0,0.85)]">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/60 animate-bounce" />
                            <span
                              className="h-2.5 w-2.5 rounded-full bg-emerald-300/60 animate-bounce"
                              style={{ animationDelay: '120ms' }}
                            />
                            <span
                              className="h-2.5 w-2.5 rounded-full bg-emerald-300/60 animate-bounce"
                              style={{ animationDelay: '240ms' }}
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {directMessageError && activeChat !== 'bot' && (
                    <div role="alert" className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                      {directMessageError}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-white/8 bg-[#151516] px-4 py-4 md:px-6">
                <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
                  {activeChat === 'bot' && (
                    <div className="flex flex-wrap gap-2 md:hidden">
                      {promptHistory.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400"
                          onClick={() => handleSendMessage(prompt)}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="rounded-[30px] border border-white/8 bg-[#202022] p-2 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.95)]">
                    <div className="flex items-center gap-3 rounded-[24px] bg-[#111112] px-4 py-3">
                      <div className="hidden rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-400 md:inline-flex">
                        {activeChat === 'bot' ? 'Ask anything' : 'Message'}
                      </div>
                      <Input
                        type="text"
                        placeholder={inputPlaceholder}
                        value={inputValue}
                        onChange={(event) => setInputValue(event.target.value)}
                        onKeyDown={handleKeyDown}
                        className="h-11 border-0 bg-transparent px-0 text-[15px] text-white shadow-none placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <Button
                        onClick={() => handleSendMessage()}
                        disabled={!inputValue.trim() || isSending}
                        aria-label="Send message"
                        size="icon"
                        className="h-11 w-11 rounded-2xl bg-white text-black hover:bg-zinc-200 disabled:opacity-40"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <p className="px-1 text-xs text-zinc-500">
                    {activeChat === 'bot'
                      ? 'Recommendations reflect live API results when available and gracefully fall back to demo data when the backend is offline.'
                      : 'Messages are delivered instantly and stored securely.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Panel Overlay */}
          <AnimatePresence>
            {notificationPanelOpen && (
              <NotificationPanel
                notifications={notifications}
                onMarkRead={handleMarkNotificationRead}
                onClose={() => setNotificationPanelOpen(false)}
              />
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* User Profile Modal */}
      {user && (
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          employeeId={user.employee_id}
          onProfileUpdated={refreshUser}
        />
      )}

      {/* Floating In-App DM Toasts */}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
              className="pointer-events-auto flex w-full flex-col rounded-2xl border border-emerald-500/25 bg-[#121213]/95 p-4 text-white shadow-2xl backdrop-blur-xl cursor-pointer hover:bg-zinc-900/90 transition-all duration-200"
              onClick={() => {
                setActiveChat(toast.senderId);
                setToasts(prev => prev.filter(t => t.id !== toast.id));
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400">New Message</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setToasts(prev => prev.filter(t => t.id !== toast.id));
                  }}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 text-sm font-semibold">{toast.senderName}</p>
              <p className="mt-1 text-xs text-zinc-400 line-clamp-2">{toast.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
