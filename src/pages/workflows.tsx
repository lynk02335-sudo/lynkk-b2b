import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCustomer } from '@/hooks/useCustomer'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { RefreshCw, Zap, BellOff, Loader2, GitBranch } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

const templates = [
  { id: 'trial_recovery', inactive_days_trigger: 5, label: 'Trial Recovery', icon: RefreshCw },
  { id: 'onboarding_activation', inactive_days_trigger: 1, label: 'Onboarding Activation', icon: Zap },
  { id: 'silent_churn', inactive_days_trigger: 7, label: 'Silent Churn', icon: BellOff }
]

export function WorkflowsPage() {
  const { customer, loading: customerLoading, error: customerError } = useCustomer()
  const { toast } = useToast()
  const [workflows, setWorkflows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [config, setConfig] = useState({
    inactive_days_trigger: 5,
    whatsapp_message: '',
  })

  useEffect(() => {
    if (customerLoading) return
    if (!customer?.id) {
      setLoading(false)
      return
    }

    const seedWorkflows = async (customerId: string) => {
      console.log("Workflow: seeding for customer", customerId)
      const templatesToSeed = [
        { template_id: 'trial_recovery', inactive_days_trigger: 5 },
        { template_id: 'onboarding_activation', inactive_days_trigger: 1 },
        { template_id: 'silent_churn', inactive_days_trigger: 7 }
      ]
      
      for (const template of templatesToSeed) {
        const { data } = await supabase
          .from('workflows')
          .select('id')
          .eq('customer_id', customerId)
          .eq('template_id', template.template_id)
          .single()
        
        if (!data) {
          await supabase.from('workflows').insert({
            customer_id: customerId,
            template_id: template.template_id,
            is_active: false,
            inactive_days_trigger: template.inactive_days_trigger,
            whatsapp_message: 'Hi {{user_name}}, we noticed you have not logged into {{product_name}} in {{days_inactive}} days. Can we help?'
          })
        }
      }
      fetchWorkflows()
    }

    const fetchWorkflows = async () => {
      console.log("Workflow: fetching workflows")
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('customer_id', customer.id)

      if (error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to load workflows" })
      } else {
        setWorkflows(data || [])
      }
      setLoading(false)
    }

    seedWorkflows(customer.id)
  }, [customer?.id, customerLoading])

  const handleToggleActive = async (workflow: any) => {
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
        console.log("Workflow: toggled active/inactive", workflow.template_id, newStatus)
        setWorkflows(prev => prev.map(w => w.id === workflow.id ? { ...w, is_active: newStatus } : w))
        toast({ title: "Success", description: `Workflow ${newStatus ? 'activated' : 'deactivated'}` })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Something went wrong" })
    } finally {
      setTogglingId(null)
    }
  }

  const openConfig = (workflow: any) => {
    setSelectedWorkflow(workflow)
    setConfig({
      inactive_days_trigger: workflow.inactive_days_trigger,
      whatsapp_message: workflow.whatsapp_message || '',
    })
    setConfigOpen(true)
  }

  const handleSaveConfig = async () => {
    if (!selectedWorkflow) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from('workflows')
        .update({
          inactive_days_trigger: config.inactive_days_trigger,
          whatsapp_message: config.whatsapp_message,
        })
        .eq('id', selectedWorkflow.id)

      if (error) {
        toast({ variant: "destructive", title: "Error", description: error.message })
      } else {
        setWorkflows(prev => prev.map(w => w.id === selectedWorkflow.id ? { ...w, ...config } : w))
        toast({ title: "Success", description: "Workflow configuration saved" })
        setConfigOpen(false)
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

  if (!customer) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 text-center p-8">
          <GitBranch className="w-16 h-16 text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {customerError || "Customer record not found"}
          </h2>
          <p className="text-muted-foreground max-w-md">
            {customerError 
              ? "We encountered an issue accessing your account. Please try refreshing or contact support."
              : "There was an error loading your workflow profile. Please try logging out and back in."}
          </p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-muted-foreground">Automate user engagement based on behavior</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {templates.map((template) => {
            const workflow = workflows.find(w => w.template_id === template.id)
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
                      <Button variant="outline" size="sm" onClick={() => openConfig(workflow)}>
                        Configure
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Sheet open={configOpen} onOpenChange={setConfigOpen}>
          <SheetContent className="w-[400px] sm:max-w-[400px]">
            <SheetHeader>
              <SheetTitle>Configure Workflow</SheetTitle>
              <SheetDescription>
                Set up trigger and message settings for this workflow.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-6 mt-6">
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
                <Label>Message Template</Label>
                <textarea
                  className="w-full min-h-[150px] p-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={config.whatsapp_message}
                  onChange={(e) => setConfig(prev => ({ ...prev, whatsapp_message: e.target.value }))}
                  placeholder="Hi {{user_name}}..."
                />
                <p className="text-xs text-muted-foreground">
                  Variables: {'{{user_name}}'}, {'{{product_name}}'}, {'{{days_inactive}}'}
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
          </SheetContent>
        </Sheet>
      </div>
    </DashboardLayout>
  )
}