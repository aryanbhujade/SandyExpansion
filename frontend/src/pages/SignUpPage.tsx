import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import { BotMessageSquare, Mail, Lock, User, ArrowRight, ArrowLeft } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { authApi } from "@/services/api"
import { useAuth } from "@/context/AuthContext"

export default function SignUpPage() {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login } = useAuth()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (!isSubmitting) {
      setIsSubmitting(true)
      try {
        const response = await authApi.register(name.trim(), email.trim(), password)
        login(response.access_token, response.user)
        navigate('/chat')
      } catch (requestError: unknown) {
        const message = typeof requestError === 'object' && requestError !== null && 'response' in requestError
          ? (requestError as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined
        setError(message || "Could not create the account. Check your details and try again.")
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  return (
    <div className="w-full min-h-screen bg-black font-sans flex items-center justify-center relative overflow-x-hidden py-24">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/[0.05] blur-[120px] pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

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
            <h1 className="text-2xl font-semibold tracking-tight text-white mb-2">Create an Account</h1>
            <p className="text-sm text-zinc-400 text-center">
              Join InternBot to connect with experts across your organization.
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium ml-1">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <User className="w-4 h-4 text-zinc-500" />
                </div>
                <Input
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10 h-12 bg-white/[0.03] border-white/10 text-white focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20 rounded-xl"
                  required
                />
              </div>
            </div>

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

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium ml-1">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-zinc-500" />
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                <span>{isSubmitting ? 'Creating Account...' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-zinc-400">
              Already have an account?{" "}
              <Link to="/signin" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
