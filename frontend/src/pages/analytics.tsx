import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { useCustomer } from '@/hooks/useCustomer'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts'
import { GitBranch, Users, UserCheck, TrendingUp, Activity, DollarSign, Receipt, BarChart3, ThumbsUp, MousePointerClick, ShoppingCart } from 'lucide-react'

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
  const [revenueData, setRevenueData] = useState<any>(null)
  const [revenueLoading, setRevenueLoading] = useState(true)

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

    api.get<any>('/api/analytics/revenue')
      .then(setRevenueData)
      .catch(() => {})
      .finally(() => setRevenueLoading(false))
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

  const userByEmail = useMemo(
    () => new Map(users.map(u => [u.email, u])),
    [users]
  )

  const stats = useMemo(() => {
    const { start, end } = getWeekBounds(selectedWeek)

    const weekLogs = logs.filter(l => {
      const date = new Date(l.fired_at)
      return date >= start && date <= end
    })

    const contactedEmails = new Set(weekLogs.map(l => l.tracked_user_email))
    const contacted = contactedEmails.size

    // Single pass: earliest contact time per email
    const firstContactByEmail = new Map<string, Date>()
    weekLogs.forEach(log => {
      const firedAt = new Date(log.fired_at)
      const existing = firstContactByEmail.get(log.tracked_user_email)
      if (!existing || firedAt < existing) firstContactByEmail.set(log.tracked_user_email, firedAt)
    })

    const sevenDaysLater = new Date(end)
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)

    let cameBack = 0
    contactedEmails.forEach(email => {
      const user = userByEmail.get(email)
      const firstContact = firstContactByEmail.get(email)
      if (user?.last_seen && firstContact) {
        const lastSeen = new Date(user.last_seen)
        if (lastSeen > firstContact && lastSeen <= sevenDaysLater) cameBack++
      }
    })

    const triggered = weekLogs.length
    const recoveryRate = contacted > 0 ? Math.round((cameBack / contacted) * 100) : 0

    return { triggered, contacted, cameBack, recoveryRate }
  }, [logs, userByEmail, selectedWeek])

  const chartData = useMemo(() => {
    const { end: selectedEnd } = getWeekBounds(selectedWeek)
    const weeks = []
    for (let i = 3; i >= 0; i--) {
      const weekEnd = new Date(selectedEnd)
      weekEnd.setDate(weekEnd.getDate() - (i * 7))
      const weekStart = new Date(weekEnd)
      weekStart.setDate(weekStart.getDate() - 6)

      const weekLogs = logs.filter(l => {
        const date = new Date(l.fired_at)
        return date >= weekStart && date <= weekEnd
      })

      const contactedSet = new Set(weekLogs.map(l => l.tracked_user_email))
      const contacted = contactedSet.size
      const recovered = new Set<string>()
      const afterWeekEnd = new Date(weekEnd)
      afterWeekEnd.setDate(afterWeekEnd.getDate() + 7)

      contactedSet.forEach((email: string) => {
        const user = userByEmail.get(email)
        if (user?.last_seen) {
          const lastSeen = new Date(user.last_seen)
          if (lastSeen > weekEnd && lastSeen <= afterWeekEnd) recovered.add(email)
        }
      })

      weeks.push({
        name: i === 0 ? 'This week' : `${i} week${i > 1 ? 's' : ''} ago`,
        contacted,
        recovered: recovered.size,
      })
    }
    return weeks
  }, [logs, userByEmail, selectedWeek])

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
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-500 mb-4">{customerError}</p>
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
                      {(() => {
                        const { start, end } = getWeekBounds(selectedWeek)
                        const filtered = logs.filter(l => {
                          const d = new Date(l.fired_at)
                          return d >= start && d <= end
                        })
                        return filtered.slice(0, 20).map(log => (
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
                        ))
                      })()}
                      </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {!revenueLoading && revenueData && (
              <>
                <div className="pt-6">
                  <h2 className="text-xl font-bold mb-4">Revenue Analytics</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-green-100 rounded-lg">
                            <DollarSign className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Revenue (30d)</p>
                            <p className="text-2xl font-bold">${Math.round(revenueData.total_revenue).toLocaleString()}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-blue-100 rounded-lg">
                            <Receipt className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Avg Order Value</p>
                            <p className="text-2xl font-bold">${Math.round(revenueData.avg_order_value * 100) / 100}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-purple-100 rounded-lg">
                            <TrendingUp className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">MRR</p>
                            <p className="text-2xl font-bold">${Math.round(revenueData.mrr).toLocaleString()}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-amber-100 rounded-lg">
                            <BarChart3 className="h-5 w-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Workflows with Revenue</p>
                            <p className="text-2xl font-bold">{revenueData.revenue_per_workflow?.filter((w: any) => w.revenue_attributed > 0).length || 0}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>AOV Trend (12 Weeks)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {revenueData.aov_trend?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={revenueData.aov_trend}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="aov" name="Avg Order Value" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1' }} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-muted-foreground text-sm py-8 text-center">No revenue data yet</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Weekly Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {revenueData.aov_trend?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={revenueData.aov_trend}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-muted-foreground text-sm py-8 text-center">No revenue data yet</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Revenue by Workflow</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {revenueData.revenue_per_workflow?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-3 text-sm font-medium">Workflow</th>
                              <th className="text-left py-3 text-sm font-medium">Messages Sent</th>
                              <th className="text-left py-3 text-sm font-medium">Attributed Revenue</th>
                              <th className="text-left py-3 text-sm font-medium">Revenue/Message</th>
                            </tr>
                          </thead>
                          <tbody>
                            {revenueData.revenue_per_workflow.map((wf: any) => (
                              <tr key={wf.workflow_id} className="border-b">
                                <td className="py-3 text-sm font-medium">{wf.workflow_name}</td>
                                <td className="py-3 text-sm">{wf.messages_sent}</td>
                                <td className="py-3 text-sm text-green-600 font-medium">
                                  ${Math.round(wf.revenue_attributed * 100) / 100}
                                </td>
                                <td className="py-3 text-sm">
                                  ${Math.round(wf.revenue_per_message * 100) / 100}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm py-8 text-center">No revenue attributed to workflows yet</p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
            <RecommendationsSection />
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

function RecommendationsSection() {
  const { data: recData, isLoading } = useQuery({
    queryKey: ['analytics', 'recommendations'],
    queryFn: () => api.get<any>('/api/analytics/recommendations'),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ThumbsUp className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Recommendations</h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : recData ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" /> Shown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{recData.total_shown || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                  <MousePointerClick className="h-3 w-3" /> Clicks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{recData.total_clicks || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> CTR
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{recData.overall_ctr || 0}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                  <ShoppingCart className="h-3 w-3" /> Attributed Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">${Math.round(recData.attributed_revenue || 0)}</p>
              </CardContent>
            </Card>
          </div>

          {recData.ctr_by_strategy?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">CTR by Strategy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Strategy</th>
                        <th className="pb-2 font-medium">Shown</th>
                        <th className="pb-2 font-medium">Clicks</th>
                        <th className="pb-2 font-medium">CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recData.ctr_by_strategy.map((s: any) => (
                        <tr key={s.strategy} className="border-b last:border-0">
                          <td className="py-2 capitalize">{s.strategy.toLowerCase().replace('_', ' ')}</td>
                          <td className="py-2">{s.shown}</td>
                          <td className="py-2">{s.clicks}</td>
                          <td className="py-2 font-medium">{s.ctr}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {recData.top_items?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Performing Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Item</th>
                        <th className="pb-2 font-medium">Category</th>
                        <th className="pb-2 font-medium">Price</th>
                        <th className="pb-2 font-medium">Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recData.top_items.map((item: any) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="py-2 font-medium">{item.name}</td>
                          <td className="py-2 text-muted-foreground">{item.category || '—'}</td>
                          <td className="py-2">${item.price ? Math.round(item.price * 100) / 100 : '—'}</td>
                          <td className="py-2">{item.clicks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}