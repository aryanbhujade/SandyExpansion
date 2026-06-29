import { SplineScene } from "@/components/ui/splite"
import { Card } from "@/components/ui/card"
import { SpotlightHover } from "@/components/ui/spotlight-hover"
import { Spotlight } from "@/components/ui/spotlight"
import { Button } from "@/components/ui/button"
import TextMarque from "@/components/ui/text-marque"
import HeroText from "@/components/ui/hero-shutter-text"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { BotMessageSquare, Users, Building, GraduationCap, Network, Sparkles, ArrowRight, Zap, Shield, Search, BarChart3 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { motion, type Variants } from "framer-motion"
import { useAuth } from "@/context/AuthContext"
import { CountUp } from "@/components/ui/counter"

export default function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 }
    }
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  }

  const trustMetrics = [
    { icon: <Users className="w-5 h-5" />, value: 465, suffix: "", label: "Employees" },
    { icon: <Building className="w-5 h-5" />, value: 17, suffix: "", label: "Departments" },
    { icon: <GraduationCap className="w-5 h-5" />, value: 200, suffix: "+", label: "Skills" },
    { icon: <Network className="w-5 h-5" />, value: 18, suffix: "", label: "Org Levels" },
  ]

  const features = [
    { icon: <Zap size={14} />, text: "AI-Powered" },
    { icon: <Search size={14} />, text: "Smart Search" },
    { icon: <Shield size={14} />, text: "Enterprise Ready" },
  ]

  const descriptionText = "Sandy Connect helps employees discover the best people across the organization for technologies, projects, mentorship, and domain expertise using AI-powered recommendations."

  return (
    <div className="w-full min-h-screen bg-black font-sans">
      <Card className="w-full h-screen rounded-none border-none bg-black relative overflow-x-hidden flex flex-col md:flex-row">

        {/* Subtle emerald radial glow behind left content */}
        <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/[0.04] blur-[120px] pointer-events-none animate-glow-drift" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

        {/* Static Background Spotlight */}
        <Spotlight
          className="-top-40 left-0 md:left-60 md:-top-20"
          fill="white"
        />

        {/* Spotlight that follows cursor */}
        <SpotlightHover size={600} />

        {/* Left content */}
        <div className="flex-1 p-8 md:pl-24 lg:pl-32 xl:pl-48 relative z-10 flex flex-col justify-center">

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Top Badge */}
            <motion.div variants={itemVariants} className="flex items-center gap-3 mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/20 bg-emerald-950/30 backdrop-blur-md text-emerald-400 text-sm font-medium w-fit">
                <BotMessageSquare className="w-4 h-4" />
                <span>Sandy Connect</span>
              </div>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-950/20 text-emerald-400 text-xs rounded-full px-3 py-1 font-medium">
                <Sparkles size={12} className="mr-1" />
                AI Powered
              </Badge>
            </motion.div>

            {/* Hero Title */}
            <motion.div variants={itemVariants} className="mb-2">
              <HeroText text="FIND THE RIGHT EXPERT INSTANTLY." className="w-full" textClassName="text-5xl md:text-7xl lg:text-7xl xl:text-8xl" />
            </motion.div>

            {/* Scrolling Description */}
            <motion.div variants={itemVariants} className="mt-8 max-w-xl relative z-20">
              <div className="mask-image-linear-gradient">
                <TextMarque
                  baseVelocity={-1}
                  clasname="text-lg md:text-xl font-medium leading-relaxed text-zinc-300 drop-shadow-sm pr-12"
                >
                  {descriptionText}
                </TextMarque>
              </div>
            </motion.div>

            {/* Feature Pills */}
            <motion.div variants={itemVariants} className="mt-6 flex flex-wrap gap-2">
              {features.map((feat, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="border-white/10 bg-white/5 text-zinc-400 text-xs rounded-full px-3 py-1.5 font-medium hover:border-emerald-500/30 hover:text-emerald-400 transition-colors cursor-default"
                >
                  <span className="text-emerald-400 mr-1.5">{feat.icon}</span>
                  {feat.text}
                </Badge>
              ))}
            </motion.div>

            {/* CTA Buttons */}
            <motion.div variants={itemVariants} className="mt-10 flex flex-wrap gap-4 items-center">
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-8 h-12 flex items-center space-x-2"
                onClick={() => navigate('/signin')}
              >
                <BotMessageSquare className="w-4 h-4 mr-2" />
                <span>Ask Sandy</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <Button
                variant="outline"
                className="border-white/10 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300 rounded-full px-8 h-12 flex items-center space-x-2"
                onClick={() => navigate('/hierarchy')}
              >
                <Search className="w-4 h-4 mr-2 text-emerald-400/60" />
                <span>Explore Experts</span>
              </Button>

              {user?.is_admin && (
                <Button
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 rounded-full px-8 h-12 flex items-center space-x-2"
                  onClick={() => navigate('/analytics')}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  <span>Analytics &amp; Admin</span>
                </Button>
              )}
            </motion.div>

            {/* Separator */}
            <motion.div variants={itemVariants} className="mt-12">
              <Separator className="bg-gradient-to-r from-emerald-500/20 via-white/10 to-transparent max-w-2xl" />
            </motion.div>

            {/* Trust Metrics */}
            <motion.div variants={itemVariants} className="mt-8 max-w-2xl">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {trustMetrics.map((metric, idx) => (
                  <motion.div
                    key={idx}
                    whileHover={{ scale: 1.05, y: -2 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="group flex flex-col gap-1.5 p-3 rounded-xl border border-transparent hover:border-emerald-500/20 hover:bg-emerald-950/10 transition-colors cursor-default"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-950/60 transition-colors">
                        {metric.icon}
                      </div>
                      <CountUp value={metric.value} suffix={metric.suffix} className="text-2xl font-bold text-white" />
                    </div>
                    <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold group-hover:text-zinc-400 transition-colors">
                      {metric.label}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

          </motion.div>
        </div>

        {/* Right content (3D Robot) */}
        <div className="flex-1 relative h-[50vh] md:h-full flex items-center justify-center">
          {/* Emerald glow behind robot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-emerald-500/[0.06] blur-[100px] pointer-events-none" />
          <div className="absolute inset-0 pointer-events-auto">
            <SplineScene
              scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
              className="w-full h-full transform scale-110 md:scale-100"
            />
          </div>
        </div>
      </Card>
    </div>
  )
}
