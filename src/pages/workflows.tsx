import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useCustomer } from '@/hooks/useCustomer'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Workflow as DBWorkflow } from '@/types/database'
import { RefreshCw, Zap, BellOff, Loader2, GitBranch, Plus, ExternalLink, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useWorkflows as useAPIWorkflows, useDeleteWorkflow } from '@/hooks/use-workflows'

const templates = [
  { id: 'trial_recovery', inactive_days_trigger: 5, label: 'Trial Recovery', icon: RefreshCw },
  { id: 'onboarding_activation', inactive_days_trigger: 1, label: 'Onboarding Activation', icon: Zap },
  { id: 'silent_churn', inactive_days_trigger: 7, label: 'Silent Churn', icon: BellOff }
]

export function WorkflowsPage() {
  const navigate = useNavigate()
  const { customer, loading: customerLoading, error: customerError } = useCustomer()
  const { toast } = useToast()
  const { data: apiWorkflows, refetch } = useAPIWorkflows()
  const deleteWorkflow = useDeleteWorkflow()
  const seededRef = useRef(false)
  const [loading, setLoading] = useState(true)
  const [selectedWorkflow, setSelectedWorkflow] = useState<DBWorkflow | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [config, setConfig] = useState({
    inactive_days_trigger: 5,
    whatsapp_message: '',
    provider: '360dialog',
    slack_webhook: ''
  })

  useEffect(() => {
    if (!customerLoading && customer?.id) {
      seedWorkflows(customer.id)
    }
    if (customerError || (!customerLoading && !customer?.id)) {
      setLoading(false)
    }
  }, [customer?.id, customerLoading, customerError])

  useEffect(() => {
    if (apiWorkflows) setLoading(false)
  }, [apiWorkflows])

  const seedWorkflows = async (customerId: string) => {
    if (seededRef.current) return
    seededRef.current = true

    const templateTypes = ['trial_recovery', 'onboarding_activation', 'silent_churn'] as const

    // Single batch check — only proceed if at least one template is missing
    const { count } = await supabase
      .from('workflows')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .in('type', templateTypes)

    if (count === 3) return

    const templatesToSeed = [
      {
        name: 'Trial Recovery',
        type: 'trial_recovery' as const,
        inactive_days_trigger: 5,
        whatsapp_message: 'Hi {{user_name}}, we noticed you have not logged into {{product_name}} in {{days_inactive}} days. Can we help you get back on track?'
      },
      {
        name: 'Onboarding Activation',
        type: 'onboarding_activation' as const,
        inactive_days_trigger: 1,
        whatsapp_message: 'Hi {{user_name}}, did you get stuck setting up {{product_name}}? We are here to help.'
      },
      {
        name: 'Silent Churn',
        type: 'silent_churn' as const,
        inactive_days_trigger: 7,
        whatsapp_message: ''
      }
    ]

    for (const template of templatesToSeed) {
      const { data: existing } = await supabase
        .from('workflows')
        .select('id')
        .eq('customer_id', customerId)
        .eq('type', template.type)
        .maybeSingle()

      if (!existing) {
        const { error } = await supabase
          .from('workflows')
          .insert({
            customer_id: customerId,
            name: template.name,
            type: template.type,
            status: 'draft',
            is_active: false,
            inactive_days_trigger: template.inactive_days_trigger,
            whatsapp_message: template.whatsapp_message,
            config: {},
          })
        if (error) console.error('Failed to seed workflow:', error)
      }
    }
  }

  const templateWorkflows = apiWorkflows?.filter(w => ['trial_recovery', 'onboarding_activation', 'silent_churn'].includes(w.type)) || []
  const customWorkflows = apiWorkflows?.filter(w => w.type === 'custom') || []

  const handleToggleActive = async (workflow: DBWorkflow | { id: string; is_active: boolean }) => {
    const newStatus = !workflow.is_active
    setTogglingId(workflow.id)
    
    try {
      const { error } = await supabase
        .from('workflows')
        .update({ is_active: newStatus })
        .eq('id', workflow.id)

      if (error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to update workflow status" })
      } else {
        refetch()
        toast({ title: "Success", description: `Workflow ${newStatus ? 'activated' : 'deactivated'}` })
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Something went wrong" })
    } finally {
      setTogglingId(null)
    }
  }

  const openConfig = (workflow: DBWorkflow) => {
    console.log("Opening workflow:", workflow)
    setSelectedWorkflow(workflow)
    const workflowConfig = (workflow.config as any) || {}
    setConfig({
      inactive_days_trigger: workflow.inactive_days_trigger,
      whatsapp_message: workflow.whatsapp_message || '',
      provider: workflowConfig.provider || '360dialog',
      slack_webhook: workflowConfig.slack_webhook || ''
    })
    setIsSheetOpen(true)
  }

  const handleSaveConfig = async () => {
    if (!selectedWorkflow) return
    setSaving(true)

    const payload = {
      inactive_days_trigger: config.inactive_days_trigger,
      whatsapp_message: config.whatsapp_message,
      config: {
        ...(selectedWorkflow.config as any || {}),
        provider: config.provider,
        slack_webhook: config.slack_webhook
      }
    }

    console.log("Saving workflow config:", payload)

    try {
      const { error } = await supabase
        .from('workflows')
        .update(payload)
        .eq('id', selectedWorkflow.id)

      if (error) {
        toast({ variant: "destructive", title: "Error", description: error.message })
      } else {
        refetch()
        toast({ title: "Success", description: "Workflow configuration saved" })
        setIsSheetOpen(false)
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save configuration" })
    } finally {
      setSaving(false)
    }
  }

  if (customerLoading || loading) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-64" />
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (customerError) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 text-center p-8">
          <GitBranch className="w-16 h-16 text-yellow-500 mb-4" />
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Workflows</h1>
            <p className="text-muted-foreground">Automate user engagement based on behavior</p>
          </div>
          <Button onClick={() => navigate('/workflows/new')} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="mr-2 h-4 w-4" /> New Workflow
          </Button>
        </div>

        {/* Custom Workflows */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Custom Workflows</h2>
              <Badge variant="secondary" className="text-xs">
                {customWorkflows.length} saved
              </Badge>
            </div>
          </div>

          {customWorkflows.length === 0 ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <p className="text-muted-foreground">
                No custom workflows yet. Click + New Workflow to create one.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {customWorkflows.map((wf) => {
                const config = (wf.config as any) || {}
                const steps: unknown[] = Array.isArray(config.steps) ? config.steps : []
                return (
                  <Card key={wf.id} className="hover:border-indigo-300 transition-colors">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 grid grid-cols-5 gap-4 items-center">
                          <div>
                            <p className="font-medium text-sm">{wf.name || 'Custom Workflow'}</p>
                            <p className="text-xs text-muted-foreground capitalize">custom</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium">{steps.length}</p>
                            <p className="text-xs text-muted-foreground">Steps</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Trigger:</span>{' '}
                              {(config.trigger?.type as string) || 'Not set'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={wf.is_active}
                              onCheckedChange={() => handleToggleActive(wf)}
                              disabled={togglingId === wf.id}
                            />
                            <span className={`text-xs ${wf.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                              {togglingId === wf.id ? 'Saving...' : (wf.is_active ? 'Active' : 'Inactive')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button variant="outline" size="sm" onClick={() => navigate(`/workflows/${wf.id}/edit`)}>
                            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={async () => {
                              if (confirm('Are you sure you want to delete this workflow?')) {
                                try {
                                  await deleteWorkflow.mutateAsync(wf.id)
                                  toast({ title: 'Success', description: 'Workflow deleted' })
                                } catch {
                                  toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete workflow' })
                                }
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Quick Templates</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {templates.map((template) => {
              const workflow = templateWorkflows.find(w => w.type === template.id)
              const Icon = template.icon
              
              return (
                <Card key={template.id} className="relative">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-lg">{template.label}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Trigger after {workflow?.inactive_days_trigger || template.inactive_days_trigger} days of inactivity.
                    </p>
                    {workflow && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={workflow.is_active}
                            onCheckedChange={() => handleToggleActive(workflow)}
                            disabled={togglingId === workflow.id}
                          />
                          <span className={`text-xs ${workflow.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                            {togglingId === workflow.id ? 'Saving...' : (workflow.is_active ? 'Active' : 'Inactive')}
                          </span>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => openConfig(workflow as unknown as DBWorkflow)}>
                          Configure
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        <Sheet open={isSheetOpen} onOpenChange={(open) => {
          setIsSheetOpen(open)
          if (!open) setSelectedWorkflow(null)
        }}>
          <SheetContent className="w-[400px] sm:max-w-[400px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>
                {selectedWorkflow 
                  ? `Configure ${templates.find(t => t.id === (selectedWorkflow as any).type)?.label || 'Workflow'}`
                  : 'Configure Workflow'}
              </SheetTitle>
              <SheetDescription>
                Set up trigger and message settings for this workflow.
              </SheetDescription>
            </SheetHeader>

            {!selectedWorkflow ? (
              <div className="py-12 text-center text-muted-foreground">
                No workflow selected
              </div>
            ) : (
              <div className="space-y-6 mt-6 pb-8">
                <div className="space-y-2">
                  <Label>Fire this workflow after inactivity of</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={config.inactive_days_trigger}
                      onChange={(e) => setConfig(prev => ({ ...prev, inactive_days_trigger: parseInt(e.target.value) || 1 }))}
                      min={1}
                      max={90}
                      className="w-24"
                    />
                    <span className="text-muted-foreground">days</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>WhatsApp Provider</Label>
                  <Select 
                    value={config.provider} 
                    onValueChange={(v) => setConfig(prev => ({ ...prev, provider: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="360dialog">360dialog</SelectItem>
                      <SelectItem value="twilio">Twilio</SelectItem>
                      <SelectItem value="wati">Wati</SelectItem>
                      <SelectItem value="aisensy">AiSensy</SelectItem>
                      <SelectItem value="interakt">Interakt</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>WhatsApp Message Template</Label>
                  <textarea
                    className="w-full min-h-[120px] p-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={config.whatsapp_message}
                    onChange={(e) => setConfig(prev => ({ ...prev, whatsapp_message: e.target.value }))}
                    placeholder="Hi {{user_name}}..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Variables: {'{{user_name}}'}, {'{{product_name}}'}, {'{{days_inactive}}'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Slack Webhook (Optional)</Label>
                  <Input
                    value={config.slack_webhook}
                    onChange={(e) => setConfig(prev => ({ ...prev, slack_webhook: e.target.value }))}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Notifications will be sent here when the workflow fires.
                  </p>
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleSaveConfig}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Configuration
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </DashboardLayout>
  )
}