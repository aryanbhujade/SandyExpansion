import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { BotMessageSquare, Mail, Lock, ArrowRight, ArrowLeft } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { authApi } from "@/services/api"
import { useAuth } from "@/context/AuthContext"

export default function SignInPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login } = useAuth()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    
    if (email && password && !isSubmitting) {
      setIsSubmitting(true)
      try {
        const response = await authApi.login(email.trim(), password)
        login(response.access_token, response.user)
        navigate('/chat')
      } catch {
        setError("Invalid email or password.")
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  return (
    <div className="w-full min-h-screen bg-black font-sans flex items-center justify-center relative overflow-x-hidden py-24">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/[0.05] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

      {/* Back Button */}
      <button 
        onClick={() => navigate('/')}
        className="absolute top-8 left-8 flex items-center text-zinc-400 hover:text-white transition-colors z-20"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        <span className="text-sm font-medium">Back to Home</span>
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md z-10 px-4"
      >
        <Card className="bg-[#111112]/90 border-white/8 backdrop-blur-xl rounded-[28px] p-8 shadow-[0_20px_50px_-35px_rgba(0,0,0,0.85)]">
          <div className="flex flex-col items-center mb-8">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 mb-4">
              <BotMessageSquare className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white mb-2">Welcome Back</h1>
            <p className="text-sm text-zinc-400 text-center">
              Sign in to InternBot to discover experts and connect with your team.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium ml-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Mail className="w-4 h-4 text-zinc-500" />
                </div>
                <Input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12 bg-white/[0.03] border-white/10 text-white focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20 rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium ml-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-zinc-500" />
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-12 bg-white/[0.03] border-white/10 text-white focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20 rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium h-12 rounded-xl flex items-center justify-center space-x-2 transition-colors"
              >
                <span>{isSubmitting ? 'Signing In...' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-zinc-400">
              Use your seeded Sandy Connect employee credentials.
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
