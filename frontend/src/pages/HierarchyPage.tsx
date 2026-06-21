import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Network, Briefcase } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

// 15 mock employees representing the hierarchy
const employees = [
  { id: "E001", name: "Anudit Sinha", email: "anudit@example.com", level: "L8", role: "Associate Manager", department: "Technology", manager_id: "E012" },
  { id: "E002", name: "Aryan Mehta", email: "aryan@example.com", level: "L2", role: "Programmer Analyst", department: "Technology", manager_id: "E006" },
  { id: "E003", name: "Priya Nair", email: "priya.nair@example.com", level: "L5", role: "Senior Consultant", department: "DevOps", manager_id: "E006" },
  { id: "E004", name: "Ravi Menon", email: "ravi.menon@example.com", level: "L6", role: "Lead DevOps Engineer", department: "DevOps", manager_id: "E006" },
  { id: "E005", name: "Meera Shah", email: "meera.shah@example.com", level: "L5", role: "Business Systems Analyst", department: "Corporate", manager_id: "E009" },
  { id: "E006", name: "Harish Idilingotter", email: "harish@example.com", level: "L8", role: "Associate Manager", department: "Technology", manager_id: "E012" },
  { id: "E007", name: "Nisha Varma", email: "nisha.varma@example.com", level: "L4", role: "Marketing Coordinator", department: "Marketing", manager_id: "E011" },
  { id: "E008", name: "Karan Bedi", email: "karan.bedi@example.com", level: "L7", role: "Solutions Consultant", department: "Sales", manager_id: "E013" },
  { id: "E009", name: "Sofia Thomas", email: "sofia.thomas@example.com", level: "L9", role: "Corporate Operations Manager", department: "Corporate", manager_id: "E014" },
  { id: "E010", name: "Vikram Rao", email: "vikram.rao@example.com", level: "L10", role: "Senior Architect", department: "Architecture", manager_id: "E015" },
  { id: "E011", name: "Lena Kapoor", email: "lena.kapoor@example.com", level: "L8", role: "Marketing Lead", department: "Marketing", manager_id: "E014" },
  { id: "E012", name: "Maya Iyer", email: "maya.iyer@example.com", level: "L11", role: "Principal Architect", department: "Architecture", manager_id: "E015" },
  { id: "E013", name: "Neil D'Souza", email: "neil.dsouza@example.com", level: "L10", role: "Sales Director", department: "Sales", manager_id: "E015" },
  { id: "E014", name: "Grace Fernandes", email: "grace.fernandes@example.com", level: "L12", role: "Head of Corporate", department: "Corporate", manager_id: "E015" },
  { id: "E015", name: "Dev Malhotra", email: "dev.malhotra@example.com", level: "L16", role: "CTO", department: "Executive", manager_id: null }
]

type Employee = typeof employees[0];

const buildTree = (managerId: string | null = null): Employee[] => {
  return employees.filter(emp => emp.manager_id === managerId);
}

const getInitials = (name: string) => {
  return name.split(" ").map(n => n[0]).join("");
}

const EmployeeNode = ({ employee, depth = 0 }: { employee: Employee, depth?: number }) => {
  const reports = buildTree(employee.id);

  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: depth * 0.1 }}
        className="mb-4 relative z-10"
      >
        <Card className="bg-[#111112]/90 border-white/10 backdrop-blur-md rounded-[20px] p-4 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.8)] w-full max-w-sm hover:border-emerald-500/30 transition-colors">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12 border border-emerald-500/20 bg-emerald-950/40 shrink-0">
              <AvatarFallback className="bg-transparent text-emerald-400 font-medium text-sm">
                {getInitials(employee.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-base font-semibold text-white truncate">{employee.name}</h3>
                <span className="shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 tracking-wider">
                  {employee.level}
                </span>
              </div>
              <div className="flex items-center text-zinc-400 text-xs mb-1 gap-1.5">
                <Briefcase className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{employee.role}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-500 text-[11px] mt-2 border-t border-white/5 pt-2">
                <span className="uppercase tracking-widest">{employee.department}</span>
                {reports.length > 0 && (
                  <span className="flex items-center gap-1 font-medium bg-white/5 px-2 py-0.5 rounded-full">
                    <Network className="w-3 h-3" />
                    {reports.length} report{reports.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Render direct reports recursively */}
      {reports.length > 0 && (
        <div className="ml-8 md:ml-12 border-l border-emerald-500/10 pl-6 md:pl-10 relative mt-2">
          {/* Decorative horizontal lines linking to children */}
          <div className="absolute top-0 bottom-6 left-0 w-px bg-gradient-to-b from-emerald-500/20 to-transparent pointer-events-none" />
          
          {reports.map((report) => (
            <div key={report.id} className="relative">
              <div className="absolute -left-6 md:-left-10 top-8 w-6 md:w-10 h-px bg-emerald-500/20 pointer-events-none" />
              <EmployeeNode employee={report} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HierarchyPage() {
  const navigate = useNavigate()
  // Root level employees (manager_id is null)
  const rootEmployees = buildTree(null)

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
              onClick={() => navigate('/')}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-emerald-400" />
              <h1 className="text-lg font-semibold tracking-tight text-white">Company Hierarchy</h1>
            </div>
          </div>
          <div className="hidden md:flex items-center text-xs font-medium text-zinc-500 uppercase tracking-widest gap-4">
            <span>Total: 450 Employees</span>
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            <span>18 Levels</span>
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            <span>17 Departments</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        <div className="max-w-4xl">
          <div className="mb-12">
            <h2 className="text-3xl font-semibold tracking-tight text-white mb-3">Organizational Structure</h2>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
              Explore reporting chains and expertise distribution across the company. 
              This view displays all levels from Executive leadership down to individual contributors.
            </p>
          </div>

          <div className="mt-8">
            {rootEmployees.map(emp => (
              <EmployeeNode key={emp.id} employee={emp} />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
