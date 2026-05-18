import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useCustomer } from '@/hooks/useCustomer'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { GitBranch, Users, UserCheck, TrendingUp, Activity } from 'lucide-react'

interface WorkflowLogData {
  id: string
  tracked_user_email: string
  workflow_id: string
  action_taken: string
  status: string
  fired_at: string
  workflow_type: string
}

export function AnalyticsPage() {
  const { customer, loading: customerLoading, error: customerError } = useCustomer()
  const [logs, setLogs] = useState<WorkflowLogData[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedWeek, setSelectedWeek] = useState('current')

  useEffect(() => {
    if (customerLoading) return
    if (!customer?.id) {
      setLoading(false)
      return
    }

    const fetchData = async () => {
      console.log("DB: loading data for analytics")
      const [logsRes, usersRes] = await Promise.all([
        supabase
          .from('workflow_logs')
          .select('*, workflows(type)')
          .eq('customer_id', customer.id)
          .order('fired_at', { ascending: false })
          .limit(20),
        supabase
          .from('tracked_users')
          .select('*')
          .eq('customer_id', customer.id),
      ])

      if (logsRes.data) {
        setLogs(logsRes.data.map(l => ({
          ...l,
          workflow_type: (l as any).workflows?.type || '',
        })))
      }
      if (usersRes.data) setUsers(usersRes.data)
      setLoading(false)
    }

    fetchData()
  }, [customer?.id, customerLoading])

  const getWeekBounds = (week: string) => {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    
    if (week === 'current') {
      return { start: startOfWeek, end: new Date() }
    }
    
    const weeksAgo = parseInt(week)
    const start = new Date(startOfWeek)
    start.setDate(start.getDate() - (weeksAgo * 7))
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    
    return { start, end }
  }

  const stats = useMemo(() => {
    const { start, end } = getWeekBounds(selectedWeek)
    
    const weekLogs = logs.filter(l => {
      const date = new Date(l.fired_at)
      return date >= start && date <= end
    })

    const contactedEmails = new Set(weekLogs.map(l => l.tracked_user_email))
    const contacted = contactedEmails.size

    let cameBack = 0
    const sevenDaysLater = new Date(end)
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)

    contactedEmails.forEach(email => {
      const user = users.find(u => u.email === email)
      if (user && user.last_seen) {
        const lastSeen = new Date(user.last_seen)
        weekLogs.forEach(log => {
          const firedAt = new Date(log.fired_at)
          if (lastSeen > firedAt && lastSeen <= sevenDaysLater) {
            cameBack++
          }
        })
      }
    })

    const triggered = weekLogs.length
    const recoveryRate = contacted > 0 ? Math.round((cameBack / contacted) * 100) : 0

    return { triggered, contacted, cameBack, recoveryRate }
  }, [logs, users, selectedWeek])

  const chartData = useMemo(() => {
    const weeks = []
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)

      const weekLogs = logs.filter(l => {
        const date = new Date(l.fired_at)
        return date >= weekStart && date <= weekEnd
      })

      const contactedSet = new Set(weekLogs.map(l => l.tracked_user_email))
      const contacted = contactedSet.size
      const recovered = new Set()

      contactedSet.forEach((email: string) => {
        const user = users.find(u => u.email === email)
        if (user?.last_seen) {
          const lastSeen = new Date(user.last_seen)
          if (lastSeen > weekEnd) {
            const afterWeek = new Date(weekEnd)
            afterWeek.setDate(afterWeek.getDate() + 7)
            if (lastSeen <= afterWeek) recovered.add(email)
          }
        }
      })

      weeks.push({
        name: `Week ${4 - i}`,
        contacted,
        recovered: recovered.size,
      })
    }
    return weeks
  }, [logs, users])

  if (customerLoading || loading) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-44" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </DashboardLayout>
    )
  }

  if (customerError) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 text-center p-8">
          <TrendingUp className="w-16 h-16 text-yellow-500 mb-4" />
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

  const templateLabels: Record<string, string> = {
    trial_recovery: 'Trial Recovery',
    onboarding_activation: 'Onboarding',
    silent_churn: 'Silent Churn',
  }

  const actionLabels: Record<string, string> = {
    whatsapp_sent: 'WhatsApp',
    email_sent: 'Email',
    slack_notified: 'Slack',
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Your Growth Summary</h1>
            <p className="text-muted-foreground">Track workflow performance and user recovery</p>
          </div>
          <Select value={selectedWeek} onValueChange={setSelectedWeek}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select week" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">This Week</SelectItem>
              <SelectItem value="1">Last Week</SelectItem>
              <SelectItem value="2">2 Weeks Ago</SelectItem>
              <SelectItem value="3">3 Weeks Ago</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-16">
            <GitBranch className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No workflows have fired yet</h3>
            <p className="text-muted-foreground">Activate a workflow to see results here.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Activity className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Workflows Triggered</p>
                      <p className="text-2xl font-bold">{stats.triggered}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Users className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Users Contacted</p>
                      <p className="text-2xl font-bold">{stats.contacted}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <UserCheck className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Users Who Came Back</p>
                      <p className="text-2xl font-bold">{stats.cameBack}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-100 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Recovery Rate</p>
                      <p className="text-2xl font-bold">{stats.recoveryRate}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Weekly Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="contacted" name="Users Contacted" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="recovered" name="Users Recovered" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 text-sm font-medium">User</th>
                        <th className="text-left py-3 text-sm font-medium">Workflow</th>
                        <th className="text-left py-3 text-sm font-medium">Action</th>
                        <th className="text-left py-3 text-sm font-medium">Sent At</th>
                        <th className="text-left py-3 text-sm font-medium">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.slice(0, 20).map(log => (
                        <tr key={log.id} className="border-b">
                          <td className="py-3 text-sm">{log.tracked_user_email}</td>
                          <td className="py-3 text-sm">{templateLabels[log.workflow_type] || log.workflow_type}</td>
                          <td className="py-3 text-sm">{actionLabels[log.action_taken] || log.action_taken}</td>
                          <td className="py-3 text-sm text-muted-foreground">
                            {new Date(log.fired_at).toLocaleDateString()}
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                              log.status === 'success' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {log.status === 'success' ? 'Success' : 'Failed'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}