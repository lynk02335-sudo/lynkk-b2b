import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  GitBranch,
  BarChart3,
  Settings,
  LogOut,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useCustomer } from '@/hooks/useCustomer'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/users', icon: Users, label: 'Users' },
  { href: '/workflows', icon: GitBranch, label: 'Workflows' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { customer } = useCustomer()
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      localStorage.clear()
      navigate('/login', { replace: true })
    } catch {
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 border-r border-slate-800 flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-2 px-5 h-16 border-b border-slate-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">
            {customer?.product_name || 'Lynkk'}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href ||
              (item.href === '/workflows' && location.pathname.startsWith('/workflows'))
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <Separator className="bg-slate-800" />

        {/* Logout */}
        <div className="p-4">
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-400 hover:text-rose-400 hover:bg-slate-800"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-3" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-50">
        {children}
      </main>
    </div>
  )
}
