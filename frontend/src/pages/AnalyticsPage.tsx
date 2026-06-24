import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  BarChart3,
  ShieldCheck,
  Users,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Star,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { analyticsApi } from "@/services/api"
import { useAuth } from "@/context/AuthContext"
import type {
  AnalyticsSummary,
  AnalyticsRecommendation,
  AnalyticsFeedback,
  AnalyticsChatMessage,
} from "@/types"

const PAGE_SIZE = 10

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString()
}

type Tab = "recommendations" | "feedback" | "chat"

export default function AnalyticsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [tab, setTab] = useState<Tab>("recommendations")

  const [recs, setRecs] = useState<AnalyticsRecommendation[]>([])
  const [recsTotal, setRecsTotal] = useState(0)
  const [recsPage, setRecsPage] = useState(1)

  const [feedback, setFeedback] = useState<AnalyticsFeedback[]>([])
  const [feedbackTotal, setFeedbackTotal] = useState(0)
  const [feedbackPage, setFeedbackPage] = useState(1)

  const [messages, setMessages] = useState<AnalyticsChatMessage[]>([])
  const [messagesTotal, setMessagesTotal] = useState(0)
  const [messagesPage, setMessagesPage] = useState(1)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<number | null>(null)

  const loadSummary = useCallback(async () => {
    try {
      const data = await analyticsApi.getSummary()
      setSummary(data)
    } catch {
      setError("Failed to load analytics. Are you signed in as an admin?")
    }
  }, [])

  const loadRecs = useCallback(async (page: number) => {
    try {
      const data = await analyticsApi.getRecommendations(page, PAGE_SIZE)
      setRecs(data.items)
      setRecsTotal(data.total)
      setRecsPage(page)
    } catch {
      setError("Failed to load recommendations.")
    }
  }, [])

  const loadFeedback = useCallback(async (page: number) => {
    try {
      const data = await analyticsApi.getFeedback(page, PAGE_SIZE)
      setFeedback(data.items)
      setFeedbackTotal(data.total)
      setFeedbackPage(page)
    } catch {
      setError("Failed to load feedback.")
    }
  }, [])

  const loadMessages = useCallback(async (page: number) => {
    try {
      const data = await analyticsApi.getChatMessages(page, PAGE_SIZE)
      setMessages(data.items)
      setMessagesTotal(data.total)
      setMessagesPage(page)
    } catch {
      setError("Failed to load chat messages.")
    }
  }, [])

  useEffect(() => {
    (async () => {
      setLoading(true)
      setError("")
      await Promise.all([loadSummary(), loadRecs(1), loadFeedback(1), loadMessages(1)])
      setLoading(false)
    })()
  }, [loadSummary, loadRecs, loadFeedback, loadMessages])

  const handleDeleteMessage = async (id: number) => {
    if (!window.confirm("Delete this chat message and its recommendations, contact requests, notifications, and feedback?")) return
    setBusyId(id)
    try {
      await analyticsApi.deleteChatMessage(id)
      await Promise.all([loadSummary(), loadMessages(messagesPage), loadRecs(recsPage), loadFeedback(feedbackPage)])
    } catch {
      setError("Failed to delete chat message.")
    } finally {
      setBusyId(null)
    }
  }

  const handleDeleteFeedback = async (id: number) => {
    if (!window.confirm("Delete this feedback entry?")) return
    setBusyId(id)
    try {
      await analyticsApi.deleteFeedback(id)
      await Promise.all([loadSummary(), loadFeedback(feedbackPage)])
    } catch {
      setError("Failed to delete feedback.")
    } finally {
      setBusyId(null)
    }
  }

  const metrics = summary
    ? [
        { label: "Employees", value: summary.totals.employees, icon: <Users className="w-4 h-4" /> },
        { label: "Active Users", value: summary.totals.active_users, icon: <Users className="w-4 h-4" /> },
        { label: "Chat Messages", value: summary.totals.chat_messages, icon: <MessageSquare className="w-4 h-4" /> },
        { label: "Recommendations", value: summary.totals.recommendations, icon: <Sparkles className="w-4 h-4" /> },
        { label: "Confirmed", value: summary.totals.confirmed_recommendations, icon: <CheckCircle2 className="w-4 h-4" /> },
        { label: "Fulfilled", value: summary.totals.fulfilled_requests, icon: <CheckCircle2 className="w-4 h-4" /> },
        { label: "Feedback Entries", value: summary.totals.feedback, icon: <Star className="w-4 h-4" /> },
        { label: "Direct Messages", value: summary.totals.direct_messages, icon: <MessageSquare className="w-4 h-4" /> },
      ]
    : []

  return (
    <div className="min-h-screen bg-[#0b0b0c] font-sans relative overflow-x-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 right-1/4 w-[800px] h-[800px] rounded-full bg-emerald-500/[0.03] blur-[150px] pointer-events-none fixed" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent fixed" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0b0b0c]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/chat')}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              <h1 className="text-lg font-semibold tracking-tight text-white">Analytics &amp; Admin</h1>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 tracking-wider uppercase">
              <ShieldCheck className="w-3 h-3" />
              Admin · {user?.name}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        <div className="mb-10">
          <h2 className="text-3xl font-semibold tracking-tight text-white mb-3">Platform Analytics</h2>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
            Admin-only overview of Sandy Connect activity — recommendation confirmations, feedback signals,
            and chat history. Moderation actions (delete) are available on the chat log and feedback tables.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Summary metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {loading || !summary
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse" />
              ))
            : metrics.map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                >
                  <Card className="bg-[#111112]/90 border-white/10 backdrop-blur-md rounded-2xl p-5 hover:border-emerald-500/30 transition-colors">
                    <div className="flex items-center gap-2 text-emerald-400 mb-3">
                      <div className="p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/20">{m.icon}</div>
                      <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">{m.label}</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{m.value}</div>
                  </Card>
                </motion.div>
              ))}
        </div>

        {/* Feedback highlights + top topics */}
        {summary && (
          <div className="grid md:grid-cols-3 gap-4 mb-12">
            <Card className="bg-[#111112]/90 border-white/10 backdrop-blur-md rounded-2xl p-5">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">Avg. Rating</div>
              <div className="text-2xl font-bold text-white">{summary.feedback.average_rating} / 5</div>
              <div className="text-xs text-zinc-400 mt-1">{summary.feedback.useful_percentage}% marked useful</div>
            </Card>
            <Card className="bg-[#111112]/90 border-white/10 backdrop-blur-md rounded-2xl p-5 md:col-span-2">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-3">Top Requested Topics</div>
              {summary.top_topics.length === 0 ? (
                <p className="text-sm text-zinc-500">No topics yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {summary.top_topics.map((t) => (
                    <span key={t.topic} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-zinc-300">
                      <span className="text-emerald-400 font-semibold">{t.count}</span>
                      <span className="truncate max-w-[180px]">{t.topic}</span>
                    </span>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4">
          {([
            { key: "recommendations", label: "Recommendations" },
            { key: "feedback", label: "Feedback" },
            { key: "chat", label: "Chat Log" },
          ] as { key: Tab; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                tab === t.key
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/20"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <Card className="bg-[#111112]/90 border-white/10 backdrop-blur-md rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 flex items-center justify-center text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : tab === "recommendations" ? (
            <RecommendationsTable rows={recs} page={recsPage} total={recsTotal} onPage={loadRecs} />
          ) : tab === "feedback" ? (
            <FeedbackTable
              rows={feedback}
              page={feedbackPage}
              total={feedbackTotal}
              onPage={loadFeedback}
              onDelete={handleDeleteFeedback}
              busyId={busyId}
            />
          ) : (
            <ChatTable
              rows={messages}
              page={messagesPage}
              total={messagesTotal}
              onPage={loadMessages}
              onDelete={handleDeleteMessage}
              busyId={busyId}
            />
          )}
        </Card>
      </main>
    </div>
  )
}

// ---------- Pagination ----------

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
      <span className="text-xs text-zinc-500">Page {page} of {pages} · {total} total</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="w-3.5 h-3.5" /> Prev
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-10 text-center text-sm text-zinc-500">{label}</td>
    </tr>
  )
}

// ---------- Recommendations table ----------

function RecommendationsTable({
  rows, page, total, onPage,
}: {
  rows: AnalyticsRecommendation[]
  page: number
  total: number
  onPage: (p: number) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-widest text-zinc-500 border-b border-white/5">
            <th className="px-5 py-3 font-semibold">Recommended</th>
            <th className="px-5 py-3 font-semibold">Requested by</th>
            <th className="px-5 py-3 font-semibold">Topic</th>
            <th className="px-5 py-3 font-semibold">Score</th>
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3 font-semibold">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={6} label="No recommendations yet." />
          ) : rows.map((r) => (
            <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
              <td className="px-5 py-3">
                <div className="text-white font-medium">{r.recommended.name ?? "—"}</div>
                <div className="text-xs text-zinc-500">{r.recommended.department ?? "—"} · {r.recommended.level ?? "—"}</div>
              </td>
              <td className="px-5 py-3 text-zinc-300">{r.requester.name ?? "—"}</td>
              <td className="px-5 py-3 text-zinc-400">{r.topic ?? "—"}</td>
              <td className="px-5 py-3 text-zinc-300">{r.score}</td>
              <td className="px-5 py-3">
                <StatusPill status={r.contact_request?.status ?? "not confirmed"} />
                {r.feedback && (
                  <div className="text-[10px] text-zinc-500 mt-1">
                    ★ {r.feedback.rating ?? "—"} · {r.feedback.was_useful === null ? "—" : r.feedback.was_useful ? "useful" : "not useful"}
                  </div>
                )}
              </td>
              <td className="px-5 py-3 text-zinc-500 text-xs">{formatDateTime(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} total={total} onPage={onPage} />
    </div>
  )
}

// ---------- Feedback table ----------

function FeedbackTable({
  rows, page, total, onPage, onDelete, busyId,
}: {
  rows: AnalyticsFeedback[]
  page: number
  total: number
  onPage: (p: number) => void
  onDelete: (id: number) => void
  busyId: number | null
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-widest text-zinc-500 border-b border-white/5">
            <th className="px-5 py-3 font-semibold">Recommended</th>
            <th className="px-5 py-3 font-semibold">Topic</th>
            <th className="px-5 py-3 font-semibold">Rating</th>
            <th className="px-5 py-3 font-semibold">Useful?</th>
            <th className="px-5 py-3 font-semibold">Comment</th>
            <th className="px-5 py-3 font-semibold">Created</th>
            <th className="px-5 py-3 font-semibold text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={7} label="No feedback submitted yet." />
          ) : rows.map((f) => (
            <tr key={f.id} className="border-b border-white/5 hover:bg-white/[0.02]">
              <td className="px-5 py-3 text-zinc-300">{f.recommended?.name ?? "—"}</td>
              <td className="px-5 py-3 text-zinc-400">{f.topic ?? "—"}</td>
              <td className="px-5 py-3 text-zinc-300">{f.rating ?? "—"}</td>
              <td className="px-5 py-3 text-zinc-300">
                {f.was_useful === null ? "—" : f.was_useful ? "Yes" : "No"}
              </td>
              <td className="px-5 py-3 text-zinc-500 max-w-[280px] truncate">{f.feedback_text ?? "—"}</td>
              <td className="px-5 py-3 text-zinc-500 text-xs">{formatDateTime(f.created_at)}</td>
              <td className="px-5 py-3 text-right">
                <Button
                  variant="destructive"
                  size="xs"
                  disabled={busyId === f.id}
                  onClick={() => onDelete(f.id)}
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} total={total} onPage={onPage} />
    </div>
  )
}

// ---------- Chat log table ----------

function ChatTable({
  rows, page, total, onPage, onDelete, busyId,
}: {
  rows: AnalyticsChatMessage[]
  page: number
  total: number
  onPage: (p: number) => void
  onDelete: (id: number) => void
  busyId: number | null
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-widest text-zinc-500 border-b border-white/5">
            <th className="px-5 py-3 font-semibold">User</th>
            <th className="px-5 py-3 font-semibold">Message</th>
            <th className="px-5 py-3 font-semibold">Topic</th>
            <th className="px-5 py-3 font-semibold">Recs</th>
            <th className="px-5 py-3 font-semibold">Created</th>
            <th className="px-5 py-3 font-semibold text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={6} label="No chat messages yet." />
          ) : rows.map((m) => (
            <tr key={m.id} className="border-b border-white/5 hover:bg-white/[0.02]">
              <td className="px-5 py-3">
                <div className="text-white font-medium">{m.user_name ?? "—"}</div>
                <div className="text-xs text-zinc-500">{m.user_department ?? "—"}</div>
              </td>
              <td className="px-5 py-3 text-zinc-300 max-w-[320px] truncate">{m.message}</td>
              <td className="px-5 py-3 text-zinc-400">{m.detected_topic ?? "—"}</td>
              <td className="px-5 py-3 text-zinc-300">{m.recommendation_count}</td>
              <td className="px-5 py-3 text-zinc-500 text-xs">{formatDateTime(m.created_at)}</td>
              <td className="px-5 py-3 text-right">
                <Button
                  variant="destructive"
                  size="xs"
                  disabled={busyId === m.id}
                  onClick={() => onDelete(m.id)}
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} total={total} onPage={onPage} />
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "fulfilled"
      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
      : status === "notified"
      ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
      : "bg-white/5 border-white/10 text-zinc-400"
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
      {status}
    </span>
  )
}