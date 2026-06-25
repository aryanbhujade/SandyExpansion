import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ChatProvider } from "@/context/ChatContext"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { MotionConfig } from "framer-motion"
import LandingPage from "./pages/LandingPage"
import ChatPage from "./pages/ChatPage"
import SignInPage from "./pages/SignInPage"
import HierarchyPage from "./pages/HierarchyPage"
import AnalyticsPage from "./pages/AnalyticsPage"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-emerald-500">Loading...</div>
  if (!user) return <Navigate to="/signin" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-emerald-500">Loading...</div>
  if (!user) return <Navigate to="/signin" replace />
  if (!user.is_admin) return <Navigate to="/chat" replace />
  return <>{children}</>
}

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/signin" element={<SignInPage />} />
              <Route path="/signup" element={<Navigate to="/signin" replace />} />
              <Route path="/hierarchy" element={<HierarchyPage />} />
              <Route
                path="/chat"
                element={
                  <ProtectedRoute>
                    <ChatProvider>
                      <ChatPage />
                    </ChatProvider>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <AdminRoute>
                    <AnalyticsPage />
                  </AdminRoute>
                }
              />
            </Routes>
          </Router>
        </AuthProvider>
      </TooltipProvider>
    </MotionConfig>
  )
}

export default App