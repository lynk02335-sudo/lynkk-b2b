import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExperiments, createExperiment, updateExperiment } from '../hooks/use-experiments'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog'
import { Loader2, Plus, Play, Pause, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select"

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  RUNNING: 'bg-green-100 text-green-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
}

export default function Experiments() {
  const navigate = useNavigate()
  const { experiments, loading, refetch } = useExperiments()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    type: 'WORKFLOW' as 'WORKFLOW' | 'PERSONALIZATION',
    source_id: '',
    goal_event: '',
    variants: [{ id: 'A', name: 'Control', description: '' }, { id: 'B', name: 'Variant B', description: '' }],
    traffic_split: { A: 50, B: 50 } as Record<string, number>,
  })

  const handleCreate = async () => {
    console.log('handleCreate called', formData)
    if (!formData.name.trim() || !formData.goal_event.trim()) {
      console.log('Validation failed')
      toast.error('Name and goal event are required')
      return
    }
    setCreating(true)
    try {
      console.log('Calling createExperiment')
      const result = await createExperiment({
        name: formData.name,
        type: formData.type,
        source_id: formData.source_id || crypto.randomUUID(),
        variants: formData.variants,
        traffic_split: formData.traffic_split,
        goal_event: formData.goal_event,
      })
      toast.success('Experiment created')
      setDialogOpen(false)
      setFormData({
        name: '', type: 'WORKFLOW', source_id: '', goal_event: '',
        variants: [{ id: 'A', name: 'Control', description: '' }, { id: 'B', name: 'Variant B', description: '' }],
        traffic_split: { A: 50, B: 50 },
      })
      refetch()
      navigate(`/experiments/${result.id}`)
    } catch (err: any) {
      console.error('Create experiment error:', err)
      toast.error(err.message || 'Failed to create experiment')
    } finally {
      setCreating(false)
    }
  }

  const handleStart = async (id: string) => {
    await updateExperiment(id, { status: 'RUNNING' })
    refetch()
  }

  const handlePause = async (id: string) => {
    await updateExperiment(id, { status: 'PAUSED' })
    refetch()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <><div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Experiments</h1>
          <p className="text-gray-500">Run A/B tests on workflows and campaigns</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Experiment
        </Button>
      </div>

      {experiments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <p>No experiments yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Experiments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 pr-4">Name</th>
                    <th className="pb-3 pr-4">Type</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Variants</th>
                    <th className="pb-3 pr-4">Users</th>
                    <th className="pb-3 pr-4">Goal</th>
                    <th className="pb-3 pr-4">Winner</th>
                    <th className="pb-3 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {experiments.map((exp) => (
                    <tr
                      key={exp.id}
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/experiments/${exp.id}`)}
                    >
                      <td className="py-3 pr-4 font-medium">{exp.name}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline">{exp.type}</Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge className={statusColors[exp.status]}>{exp.status}</Badge>
                      </td>
                      <td className="py-3 pr-4">
                        {((exp.variants as any[]) || []).map((v: any) => v.name).join(', ')}
                      </td>
                      <td className="py-3 pr-4">
                        {exp.summary?.total_users ?? '-'}
                      </td>
                      <td className="py-3 pr-4 text-xs max-w-[120px] truncate">{exp.goal_event}</td>
                      <td className="py-3 pr-4">
                        {exp.summary?.winner ? (
                          <Badge className="bg-green-100 text-green-700">
                            {exp.summary.winner}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {exp.status === 'DRAFT' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStart(exp.id)}
                              title="Start experiment"
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                          {exp.status === 'RUNNING' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePause(exp.id)}
                              title="Pause experiment"
                            >
                              <Pause className="w-4 h-4" />
                            </Button>
                          )}
                          {exp.status === 'COMPLETED' && (
                            <CheckCircle className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Experiment</DialogTitle>
          <DialogDescription>
            Create an A/B test for a workflow or personalization campaign
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Experiment Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Subject line test"
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={formData.type}
              onValueChange={(v: any) => setFormData({ ...formData, type: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="WORKFLOW">Workflow</SelectItem>
                <SelectItem value="PERSONALIZATION">Personalization Campaign</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Goal Event</Label>
            <Input
              value={formData.goal_event}
              onChange={(e) => setFormData({ ...formData, goal_event: e.target.value })}
              placeholder="e.g. user.upgraded, purchase"
            />
            <p className="text-xs text-gray-500">The event that counts as a conversion</p>
          </div>

          <div className="space-y-2">
            <Label>Variants</Label>
            {formData.variants.map((v, idx) => (
              <div key={v.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{v.id}</span>
                  {formData.variants.length > 2 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const variants = formData.variants.filter((_, i) => i !== idx)
                        const split = { ...formData.traffic_split }
                        delete split[v.id]
                        setFormData({ ...formData, variants, traffic_split: split })
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <Input
                  value={v.name}
                  onChange={(e) => {
                    const variants = [...formData.variants]
                    variants[idx] = { ...variants[idx], name: e.target.value }
                    setFormData({ ...formData, variants })
                  }}
                  placeholder="Variant name"
                />
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={formData.traffic_split[v.id] || 0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0
                      setFormData({
                        ...formData,
                        traffic_split: { ...formData.traffic_split, [v.id]: Math.max(0, Math.min(100, val)) },
                      })
                    }}
                  />
                  <span className="text-xs text-gray-500">%</span>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const nextId = String.fromCharCode(65 + formData.variants.length)
                setFormData({
                  ...formData,
                  variants: [...formData.variants, { id: nextId, name: `Variant ${nextId}`, description: '' }],
                  traffic_split: { ...formData.traffic_split, [nextId]: 0 },
                })
              }}
            >
              + Add Variant
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Experiment
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </>
  )
}
