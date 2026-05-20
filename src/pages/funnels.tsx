import { useState } from 'react'
import { useFunnels, useCreateFunnel, useUpdateFunnel, useDeleteFunnel, useFunnelResults, type Funnel, type FunnelStepResult } from '@/hooks/use-funnels'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import { Filter, Plus, Pencil, Trash2, Loader2, GitFork, GripVertical, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const WINDOW_OPTIONS = [
  { value: 24, label: '24 Hours' },
  { value: 168, label: '7 Days' },
  { value: 720, label: '30 Days' },
]

const SEGMENTS = [
  { value: '', label: 'All Users' },
  { value: 'active', label: 'Active' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'cold', label: 'Cold' },
]

export default function FunnelsPage() {
  const { data: funnels, isLoading, isError, error } = useFunnels()
  const createFunnel = useCreateFunnel()
  const updateFunnel = useUpdateFunnel()
  const deleteFunnel = useDeleteFunnel()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null)
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null)
  const [segment, setSegment] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    steps: [''],
    conversion_window_hours: 168,
  })

  const { data: funnelResults, isLoading: resultsLoading } = useFunnelResults(selectedFunnelId || undefined, segment || undefined)

  const activeFunnel = selectedFunnelId
    ? funnels?.find((f: Funnel) => f.id === selectedFunnelId)
    : funnels?.[0] || null

  const handleOpenCreate = () => {
    setEditingFunnel(null)
    setFormData({ name: '', steps: [''], conversion_window_hours: 168 })
    setDialogOpen(true)
  }

  const handleOpenEdit = (funnel: Funnel) => {
    setEditingFunnel(funnel)
    setFormData({
      name: funnel.name,
      steps: funnel.steps.length > 0 ? [...funnel.steps] : [''],
      conversion_window_hours: funnel.conversion_window_hours,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const steps = formData.steps.filter(s => s.trim())
    if (steps.length < 2) {
      toast.error('Add at least 2 steps')
      return
    }

    try {
      if (editingFunnel) {
        await updateFunnel.mutateAsync({
          id: editingFunnel.id,
          name: formData.name,
          steps,
          conversion_window_hours: formData.conversion_window_hours,
        })
        toast.success('Funnel updated')
      } else {
        const result: Funnel = await createFunnel.mutateAsync({
          name: formData.name,
          steps,
          conversion_window_hours: formData.conversion_window_hours,
        })
        setSelectedFunnelId(result.id)
        toast.success('Funnel created')
      }
      setDialogOpen(false)
    } catch {
      toast.error('Failed to save funnel')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this funnel?')) return
    try {
      await deleteFunnel.mutateAsync(id)
      if (selectedFunnelId === id) setSelectedFunnelId(null)
      toast.success('Funnel deleted')
    } catch {
      toast.error('Failed to delete funnel')
    }
  }

  const addStep = () => {
    setFormData(prev => ({ ...prev, steps: [...prev.steps, ''] }))
  }

  const removeStep = (index: number) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }))
  }

  const updateStep = (index: number, value: string) => {
    setFormData(prev => {
      const steps = [...prev.steps]
      steps[index] = value
      return { ...prev, steps }
    })
  }

  const moveStep = (from: number, to: number) => {
    if (to < 0 || to >= formData.steps.length) return
    setFormData(prev => {
      const steps = [...prev.steps]
      const [moved] = steps.splice(from, 1)
      steps.splice(to, 0, moved)
      return { ...prev, steps }
    })
  }

  const chartData = funnelResults?.steps.map((s: FunnelStepResult, i: number) => ({
    name: s.name,
    users: s.user_count,
    'Conversion Rate': s.conversion_rate,
    dropOff: i > 0 ? 100 - s.conversion_rate : 0,
  })) || []

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (isError) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <Filter className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Failed to load funnels</p>
              <p className="text-sm">{(error as Error)?.message || 'An unexpected error occurred.'}</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Conversion Funnels</h1>
            <p className="text-muted-foreground">Define conversion funnels and track user drop-off</p>
          </div>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Funnel
          </Button>
        </div>

        {(!funnels || funnels.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <GitFork className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No funnels yet</h3>
            <p className="text-muted-foreground mb-4">Create your first conversion funnel to track user drop-off</p>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Funnel
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Your Funnels</h3>
              <div className="space-y-1">
                {funnels?.map((funnel: Funnel) => (
                  <button
                    key={funnel.id}
                    onClick={() => setSelectedFunnelId(funnel.id)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                      activeFunnel?.id === funnel.id
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'hover:bg-slate-100'
                    )}
                  >
                    <span>{funnel.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {funnel.steps.length} steps
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3 space-y-6">
              {activeFunnel && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">{activeFunnel.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        {activeFunnel.steps.join(' → ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={segment} onValueChange={setSegment}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="All Users" />
                        </SelectTrigger>
                        <SelectContent>
                          {SEGMENTS.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" onClick={() => handleOpenEdit(activeFunnel)}>
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDelete(activeFunnel.id)}>
                        <Trash2 className="h-3 w-3 mr-1" />
                      </Button>
                    </div>
                  </div>

                  {resultsLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-64 w-full" />
                      <Skeleton className="h-32 w-full" />
                    </div>
                  ) : funnelResults ? (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Funnel Overview</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {chartData.length > 0 ? (
                            <div className="space-y-4">
                              {funnelResults.steps.map((step: FunnelStepResult, i: number) => (
                                <div key={step.name}>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">{step.name}</span>
                                      {i > 0 && (
                                        <span className={cn(
                                          'text-xs px-1.5 py-0.5 rounded',
                                          step.conversion_rate >= 50 ? 'bg-green-100 text-green-700' :
                                          step.conversion_rate >= 25 ? 'bg-amber-100 text-amber-700' :
                                          'bg-red-100 text-red-700'
                                        )}>
                                          {step.conversion_rate}% from prev
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                      {step.user_count} users
                                      {step.median_time_to_next_step !== null && i < funnelResults.steps.length - 1 && (
                                        <span className="ml-2 text-xs">
                                          Ø {step.median_time_to_next_step}h to next
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-100 rounded-full h-3">
                                    <div
                                      className={cn(
                                        'h-3 rounded-full transition-all',
                                        i === 0 ? 'bg-indigo-500' :
                                        step.conversion_rate >= 50 ? 'bg-green-500' :
                                        step.conversion_rate >= 25 ? 'bg-amber-500' :
                                        'bg-red-500'
                                      )}
                                      style={{ width: `${Math.max(step.conversion_rate, 2)}%` }}
                                    />
                                  </div>
                                  {i < funnelResults.steps.length - 1 && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 ml-1">
                                      <span className="text-red-500">
                                        Drop-off: {100 - step.conversion_rate}%
                                      </span>
                                      <span className="text-muted-foreground">
                                        {i > 0 ? `${funnelResults.steps[i - 1].user_count - step.user_count} users lost` : ''}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-sm py-8 text-center">No data for this funnel yet</p>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Step Comparison</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {chartData.length > 0 ? (
                            <div className="h-72">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" angle={-20} textAnchor="end" height={60} />
                                  <YAxis />
                                  <Tooltip />
                                  <Bar dataKey="users" fill="#6366f1" name="Users">
                                    <LabelList dataKey="users" position="top" />
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-sm py-8 text-center">No data to display</p>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  ) : null}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingFunnel ? 'Edit Funnel' : 'Create Funnel'}</DialogTitle>
            <DialogDescription>Define the steps users take through your conversion funnel</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-2">
            <div className="space-y-2">
              <Label>Funnel Name</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Trial to Upgrade"
              />
            </div>

            <div className="space-y-3">
              <Label>Steps</Label>
              {formData.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground w-6 shrink-0">
                    <GripVertical className="h-4 w-4" />
                    <span>{i + 1}.</span>
                  </div>
                  <Input
                    value={step}
                    onChange={e => updateStep(i, e.target.value)}
                    placeholder="e.g. user.signed_up"
                    className="flex-1"
                  />
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveStep(i, i - 1)}
                      disabled={i === 0}
                      className="h-8 w-8 p-0"
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveStep(i, i + 1)}
                      disabled={i === formData.steps.length - 1}
                      className="h-8 w-8 p-0"
                    >
                      ↓
                    </Button>
                  </div>
                  {formData.steps.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStep(i)}
                      className="h-8 w-8 p-0 text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addStep}>
                <Plus className="h-3 w-3 mr-1" />
                Add Step
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Conversion Window</Label>
              <Select
                value={String(formData.conversion_window_hours)}
                onValueChange={v => setFormData({ ...formData, conversion_window_hours: Number(v) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WINDOW_OPTIONS.map(w => (
                    <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name || formData.steps.filter(s => s.trim()).length < 2 || createFunnel.isPending}
            >
              {(createFunnel.isPending || updateFunnel.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingFunnel ? 'Update Funnel' : 'Create Funnel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
