import { useState, useMemo } from 'react'
import { useSmsTemplates, useCreateSmsTemplate, useUpdateSmsTemplate, useDeleteSmsTemplate, type SmsTemplate } from '@/hooks/use-sms-templates'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, MessageSquare, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const COMMON_VARIABLES = [
  { name: 'first_name', label: 'First Name' },
  { name: 'last_name', label: 'Last Name' },
  { name: 'name', label: 'Full Name' },
  { name: 'product_name', label: 'Product Name' },
  { name: 'plan', label: 'Plan' },
  { name: 'trial_end_date', label: 'Trial End Date' },
  { name: 'days_left', label: 'Days Left' },
  { name: 'company_name', label: 'Company Name' },
]

function getSegments(body: string): number {
  if (!body) return 0
  if (body.length <= 160) return 1
  return Math.ceil(body.length / 160)
}

function insertVariable(text: string, varName: string, cursorPos: number): string {
  const insert = `{{${varName}}}`
  return text.slice(0, cursorPos) + insert + text.slice(cursorPos)
}

export default function SmsTemplatesPage() {
  const { data: templates, isLoading, isError, error } = useSmsTemplates()
  const createTemplate = useCreateSmsTemplate()
  const updateTemplate = useUpdateSmsTemplate()
  const deleteTemplate = useDeleteSmsTemplate()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null)
  const [formData, setFormData] = useState({ name: '', body: '', variables: '' })
  const [cursorPosition, setCursorPosition] = useState(0)

  const charCount = useMemo(() => formData.body.length, [formData.body])
  const segments = useMemo(() => getSegments(formData.body), [formData.body])

  const previewText = useMemo(() => {
    return formData.body.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
      const preset: Record<string, string> = {
        first_name: 'John',
        last_name: 'Doe',
        name: 'John Doe',
        product_name: 'MyApp',
        plan: 'Pro',
        trial_end_date: 'May 30, 2026',
        days_left: '5',
        company_name: 'Acme Inc',
      }
      return preset[varName] || `[${varName}]`
    })
  }, [formData.body])

  const handleOpenCreate = () => {
    setEditingTemplate(null)
    setFormData({ name: '', body: '', variables: '' })
    setCursorPosition(0)
    setDialogOpen(true)
  }

  const handleOpenEdit = (template: SmsTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      body: (template as any).body || (template as any).content || '',
      variables: (template.variables || []).join(', ')
    })
    setCursorPosition(0)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const variables = formData.variables
      ? formData.variables.split(',').map(v => v.trim()).filter(Boolean)
      : []

    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({
          id: editingTemplate.id,
          name: formData.name,
          body: formData.body,
          variables
        })
        toast.success('Template updated')
      } else {
        await createTemplate.mutateAsync({
          name: formData.name,
          body: formData.body,
          variables
        })
        toast.success('Template created')
      }
      setDialogOpen(false)
    } catch {
      toast.error('Failed to save template')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return
    try {
      await deleteTemplate.mutateAsync(id)
      toast.success('Template deleted')
    } catch {
      toast.error('Failed to delete template')
    }
  }

  const insertVar = (varName: string) => {
    const newBody = insertVariable(formData.body, varName, cursorPosition)
    setFormData({ ...formData, body: newBody })
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
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
            <MessageSquare className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Failed to load SMS templates</p>
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
            <h1 className="text-2xl font-bold">SMS Templates</h1>
            <p className="text-muted-foreground">Create and manage SMS templates for your workflows</p>
          </div>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>

        {templates && templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No SMS templates yet</h3>
            <p className="text-muted-foreground mb-4">Create your first SMS template to use in workflows</p>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates?.map((template: SmsTemplate) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Created {new Date(template.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-3 rounded-lg text-sm font-mono mb-4 whitespace-pre-wrap">
                    {(template as any).body || template.content}
                  </div>
                  {template.variables && template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {template.variables.map((v: string) => (
                        <span key={v} className="text-xs px-2 py-1 bg-primary/10 rounded">
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(template)}>
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-500 hover:text-red-600"
                      onClick={() => handleDelete(template.id)}
                      disabled={deleteTemplate.isPending}
                    >
                      {deleteTemplate.isPending ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3 mr-1" />
                      )}
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit SMS Template' : 'Create SMS Template'}</DialogTitle>
            <DialogDescription>
              SMS messages are charged per segment (160 chars = 1 segment)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-2">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Trial Reminder"
              />
            </div>

            <div className="space-y-2">
              <Label>Message Body</Label>
              <textarea
                className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-sm resize-none"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                onSelect={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  setCursorPosition(target.selectionStart)
                }}
                placeholder="Hi {{first_name}}, your trial expires in {{days_left}} days!"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className={cn(charCount > 160 && charCount <= 320 ? "text-amber-600" : charCount > 320 ? "text-red-500" : "")}>
                  {charCount}/160 characters
                </span>
                <span className={cn(
                  "font-medium",
                  segments === 1 ? "text-green-600" :
                  segments === 2 ? "text-amber-600" : "text-red-500"
                )}>
                  {segments} SMS {segments === 1 ? "credit" : "credits"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Insert Variable</Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_VARIABLES.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => insertVar(v.name)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 rounded transition-colors"
                  >
                    <Sparkles className="h-3 w-3" />
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Live Preview</Label>
              <div className="bg-muted p-4 rounded-lg border-2 border-dashed border-muted-foreground/20">
                <div className="text-sm font-mono whitespace-pre-wrap">{previewText}</div>
                <p className="text-xs text-muted-foreground mt-2">
                  Variables are replaced with placeholder values
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Variables (comma-separated)</Label>
              <Input
                value={formData.variables}
                onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
                placeholder="first_name, days_left, trial_end_date"
              />
              <p className="text-xs text-muted-foreground">
                List variable names used in this template
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSave} 
              disabled={!formData.name || !formData.body || createTemplate.isPending || updateTemplate.isPending}
            >
              {(createTemplate.isPending || updateTemplate.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingTemplate ? 'Update' : 'Create'} Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}