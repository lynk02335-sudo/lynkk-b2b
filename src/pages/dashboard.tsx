import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useCustomer } from '@/hooks/useCustomer'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Users, Activity, AlertTriangle, Snowflake, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import type { TrackedUser } from '@/types/database'

type StatusFilter = 'all' | 'active' | 'at_risk' | 'cold'

interface MetricCardProps {
  title: string
  value: number | string
  icon: React.ReactNode
  subtitle: string
  color?: string
}

function MetricCard({ title, value, icon, subtitle, color }: MetricCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-x-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <div className="flex items-baseline space-x-1">
              <h2 className={`text-3xl font-bold tracking-tight ${color || ''}`}>
                {value}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className={`p-3 rounded-xl ${color ? `${color} bg-opacity-10` : 'bg-primary/10'}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function getStatus(lastSeen: string): 'active' | 'at_risk' | 'cold' {
  const hoursSinceLastSeen = (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60)
  
  if (hoursSinceLastSeen <= 48) return 'active'
  if (hoursSinceLastSeen <= 120) return 'at_risk'
  return 'cold'
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ lastSeen }: { lastSeen: string }) {
  const status = getStatus(lastSeen)
  
  const styles = {
    active: 'bg-green-100 text-green-700',
    at_risk: 'bg-yellow-100 text-yellow-700',
    cold: 'bg-red-100 text-red-700',
  }
  
  const labels = {
    active: 'Active',
    at_risk: 'At Risk',
    cold: 'Cold',
  }
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status === 'active' && '🟢 '}
      {status === 'at_risk' && '🟡 '}
      {status === 'cold' && '🔴 '}
      {labels[status]}
    </span>
  )
}

export function DashboardPage() {
  const { customer, loading: customerLoading, error: customerError } = useCustomer()
  const [users, setUsers] = useState<TrackedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const pageSize = 20

  useEffect(() => {
    if (customerLoading) return
    if (!customer?.id) {
      setLoading(false)
      return
    }

    const fetchUsers = async () => {
      console.log("DB: loading users for dashboard")
      const { data, error } = await supabase
        .from('tracked_users')
        .select('*')
        .eq('customer_id', customer.id)
        .order('last_seen', { ascending: false })

      if (!error && data) {
        console.log("Dashboard users:", data)
        setUsers(data)
      }
      setLoading(false)
    }

    fetchUsers()

    const channel = supabase
      .channel('tracked_users_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tracked_users',
        filter: `customer_id=eq.${customer.id}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setUsers(prev => [payload.new as TrackedUser, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setUsers(prev => prev.map(u => u.id === payload.new.id ? payload.new as TrackedUser : u))
        } else if (payload.eventType === 'DELETE') {
          setUsers(prev => prev.filter(u => u.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [customer?.id, customerLoading])

  const filteredUsers = useMemo(() => {
    let result = users

    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(u => 
        u.email.toLowerCase().includes(searchLower) ||
        (u.name && u.name.toLowerCase().includes(searchLower))
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter(u => {
        const status = getStatus(u.last_seen)
        return status === statusFilter
      })
    }

    return result
  }, [users, search, statusFilter])

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredUsers.slice(start, start + pageSize)
  }, [filteredUsers, page])

  const totalPages = Math.ceil(filteredUsers.length / pageSize)

  const metrics = useMemo(() => {
    const u = users || []
    return {
      total: u.length,
      active: u.filter(user => user.status === 'active').length,
      atRisk: u.filter(user => user.status === 'at_risk').length,
      cold: u.filter(user => user.status === 'cold').length,
    }
  }, [users])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  if (customerLoading || loading) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (customerError) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 text-center p-8">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Something went wrong. Please refresh the page.</h2>
          <Button onClick={() => window.location.reload()} variant="outline">
            Refresh
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  if (!customer) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your user engagement and health</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Users"
            value={metrics.total}
            subtitle="All tracked users"
            icon={<Users className="w-6 h-6 text-primary" />}
          />
          <MetricCard
            title="Active Users"
            value={metrics.active}
            subtitle="Seen in last 48h"
            icon={<Activity className="w-6 h-6 text-green-600" />}
            color="text-green-600"
          />
          <MetricCard
            title="At Risk"
            value={metrics.atRisk}
            subtitle="48h - 120h inactive"
            icon={<AlertTriangle className="w-6 h-6 text-yellow-600" />}
            color="text-yellow-600"
          />
          <MetricCard
            title="Cold Users"
            value={metrics.cold}
            subtitle="> 120h inactive"
            icon={<Snowflake className="w-6 h-6 text-red-600" />}
            color="text-red-600"
          />
        </div>

        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border border-dashed border-gray-300 text-center px-8">
            <div className="p-4 bg-muted/20 rounded-full mb-4">
              <Users className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No users tracked yet</h2>
            <p className="text-muted-foreground max-w-md mb-6 text-sm">
              Connect your application by installing the tracking script. You'll see user data appearing here in real-time.
            </p>
            <Button onClick={() => window.location.href = '/settings'}>
              View Installation Guide
            </Button>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="cold">Cold</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        First Seen
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Last Seen
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Last Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{user.email}</span>
                            {user.name && <span className="text-xs text-muted-foreground">{user.name}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {formatDate(user.first_seen)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {formatDate(user.last_seen)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge lastSeen={user.last_seen} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {user.last_action || <span className="text-gray-300 italic">None</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pb-8">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-gray-900">{((page - 1) * pageSize) + 1}</span> to <span className="font-medium text-gray-900">{Math.min(page * pageSize, filteredUsers.length)}</span> of <span className="font-medium text-gray-900">{filteredUsers.length}</span> users
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}