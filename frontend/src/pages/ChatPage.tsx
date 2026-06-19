import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
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
} from 'lucide-react';
import { motion } from 'framer-motion';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatContext } from '@/context/ChatContext';
import type { Message, RecommendationItem, RecommendationNotificationState } from '@/types';

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
}: {
  recommendation: RecommendationItem;
  canNotify: boolean;
  notificationState?: RecommendationNotificationState;
  onNotify: () => void;
}) {
  const notificationStatus = notificationState?.status;
  const notificationMessage = notificationState?.message;

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
            Notify this expert that you would like an introduction.
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
              {notificationStatus === 'sending' ? 'Notifying...' : 'Notify contact'}
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
        <div className="mt-4 inline-flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-2 text-xs text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{notificationMessage}</span>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const navigate = useNavigate();
  const {
    messages,
    isTyping,
    sendMessage,
    confirmRecommendation,
    clearChat,
    backendAvailable,
  } = useChatContext();
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSendMessage = (text?: string) => {
    const messageText = text ?? inputValue.trim();

    if (!messageText) return;

    setInputValue('');
    void sendMessage(messageText);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSendMessage();
    }
  };

  const promptHistory = recentUserPrompts(messages);
  const showEmptyState = messages.length <= 1 && !isTyping;
  const renderedMessages = showEmptyState
    ? messages.filter((message) => message.id !== 'welcome')
    : messages;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0b0c] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(78,87,255,0.14),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.10),_transparent_26%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_16%,transparent_84%,rgba(255,255,255,0.02))]" />

      <div className="relative flex min-h-screen flex-col md:flex-row">
        <aside className="w-full shrink-0 border-b border-white/6 bg-[#111112]/90 backdrop-blur-2xl md:min-h-screen md:w-[290px] md:border-b-0 md:border-r">
          <div className="flex h-full flex-col px-4 py-4 md:px-5 md:py-6">
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                className="h-10 rounded-2xl border border-white/8 bg-white/[0.03] px-3 text-zinc-200 hover:bg-white/[0.06]"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Home
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

            <div className="mt-6 rounded-[28px] border border-white/8 bg-white/[0.03] p-4 shadow-[0_20px_50px_-35px_rgba(0,0,0,0.85)]">
              <div className="flex items-start gap-3">
                <Avatar className="h-11 w-11 border border-white/10 bg-[#1d1d1f]">
                  <AvatarFallback className="bg-transparent text-zinc-100">
                    <Bot className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Workspace</p>
                  <h1 className="mt-2 text-lg font-semibold tracking-tight text-white">
                    InternBot
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Expert discovery across teams, skills, and mentorship requests.
                  </p>
                </div>
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

            <div className="mt-6 hidden min-h-0 flex-1 flex-col md:flex">
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
        </aside>

        <main className="flex min-h-screen min-w-0 flex-1 flex-col">
          <div className="border-b border-white/6 bg-[#121213]/70 px-4 py-4 backdrop-blur-xl md:px-6">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">
                  AI Chat Workspace
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight text-white">Chat with InternBot</h2>
                  <span className="inline-flex items-center rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs text-zinc-400">
                    <Sparkles className="mr-1.5 h-3.5 w-3.5 text-violet-300" />
                    Talent intelligence
                  </span>
                </div>
              </div>

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

          <div className="flex-1 px-3 py-3 md:px-6 md:py-5">
            <div className="mx-auto flex h-[calc(100vh-8.5rem)] max-w-6xl flex-col overflow-hidden rounded-[32px] border border-white/8 bg-[#171718]/88 shadow-[0_30px_120px_-45px_rgba(0,0,0,0.9)]">
              <ScrollArea className="min-h-0 flex-1">
                <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
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

                  {isTyping && (
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

                  <div ref={scrollRef} className="h-2" />
                </div>
              </ScrollArea>

              <div className="border-t border-white/8 bg-[#151516] px-4 py-4 md:px-6">
                <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
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

                  <div className="rounded-[30px] border border-white/8 bg-[#202022] p-2 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.95)]">
                    <div className="flex items-center gap-3 rounded-[24px] bg-[#111112] px-4 py-3">
                      <div className="hidden rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-400 md:inline-flex">
                        Ask anything
                      </div>
                      <Input
                        type="text"
                        placeholder="Ask InternBot about skills, teams, or who can help next..."
                        value={inputValue}
                        onChange={(event) => setInputValue(event.target.value)}
                        onKeyDown={handleKeyDown}
                        className="h-11 border-0 bg-transparent px-0 text-[15px] text-white shadow-none placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <Button
                        onClick={() => handleSendMessage()}
                        disabled={!inputValue.trim() || isTyping}
                        size="icon"
                        className="h-11 w-11 rounded-2xl bg-white text-black hover:bg-zinc-200 disabled:opacity-40"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <p className="px-1 text-xs text-zinc-500">
                    Recommendations reflect live API results when available and gracefully fall back to demo data when the backend is offline.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
