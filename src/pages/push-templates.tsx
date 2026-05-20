import { useState, useMemo } from 'react'
import { usePushTemplates, useCreatePushTemplate, useUpdatePushTemplate, useDeletePushTemplate, type PushTemplate } from '@/hooks/use-push-templates'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Bell, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const COMMON_VARIABLES = [
  { name: 'first_name', label: 'First Name' },
  { name: 'last_name', label: 'Last Name' },
  { name: 'name', label: 'Full Name' },
  { name: 'product_name', label: 'Product Name' },
  { name: 'product_url', label: 'Product URL' },
  { name: 'company_name', label: 'Company Name' },
]

const MAX_TITLE = 50
const MAX_BODY = 100

export default function PushTemplatesPage() {
  const { data: templates, isLoading, isError, error } = usePushTemplates()
  const createTemplate = useCreatePushTemplate()
  const updateTemplate = useUpdatePushTemplate()
  const deleteTemplate = useDeletePushTemplate()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<PushTemplate | null>(null)
  const [formData, setFormData] = useState({ 
    name: '', 
    title: '', 
    body: '', 
    icon_url: '', 
    cta_url: '', 
    variables: '' 
  })

  const titleCount = useMemo(() => formData.title.length, [formData.title])
  const bodyCount = useMemo(() => formData.body.length, [formData.body])

  const previewText = useMemo(() => {
    return {
      title: formData.title.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
        const preset: Record<string, string> = {
          first_name: 'John',
          last_name: 'Doe',
          name: 'John Doe',
          product_name: 'MyApp',
          company_name: 'Acme Inc',
        }
        return preset[varName] || `[${varName}]`
      }),
      body: formData.body.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
        const preset: Record<string, string> = {
          first_name: 'John',
          last_name: 'Doe',
          name: 'John Doe',
          product_name: 'MyApp',
          product_url: 'https://myapp.com',
          company_name: 'Acme Inc',
        }
        return preset[varName] || `[${varName}]`
      }),
    }
  }, [formData.title, formData.body])

  const handleOpenCreate = () => {
    setEditingTemplate(null)
    setFormData({ name: '', title: '', body: '', icon_url: '', cta_url: '', variables: '' })
    setDialogOpen(true)
  }

  const handleOpenEdit = (template: PushTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      title: template.title,
      body: template.body,
      icon_url: template.icon_url || '',
      cta_url: template.cta_url || '',
      variables: (template.variables || []).join(', ')
    })
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
          title: formData.title,
          body: formData.body,
          icon_url: formData.icon_url || undefined,
          cta_url: formData.cta_url || undefined,
          variables
        })
        toast.success('Template updated')
      } else {
        await createTemplate.mutateAsync({
          name: formData.name,
          title: formData.title,
          body: formData.body,
          icon_url: formData.icon_url || undefined,
          cta_url: formData.cta_url || undefined,
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
    setFormData(prev => ({ ...prev, body: prev.body + `{{${varName}}}` }))
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
              <Skeleton key={i} className="h-48 w-full" />
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
            <Bell className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Failed to load push templates</p>
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
            <h1 className="text-2xl font-bold">Push Notification Templates</h1>
            <p className="text-muted-foreground">Create and manage push notification templates for your workflows</p>
          </div>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>

        {templates && templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No push templates yet</h3>
            <p className="text-muted-foreground mb-4">Create your first push template to use in workflows</p>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates?.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Created {new Date(template.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    <div className="font-semibold text-sm">{template.title}</div>
                    <div className="text-sm text-muted-foreground line-clamp-2">{template.body}</div>
                  </div>
                  {template.variables && template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {template.variables.map((v) => (
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
            <DialogTitle>{editingTemplate ? 'Edit Push Template' : 'Create Push Template'}</DialogTitle>
            <DialogDescription>
              Push notifications: max 50 chars title, max 100 chars body
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-2">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Trial Ending Soon"
              />
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value.slice(0, MAX_TITLE) })}
                placeholder="Your trial is ending"
              />
              <div className={cn(
                "text-xs",
                titleCount > MAX_TITLE ? "text-red-500" : titleCount > MAX_TITLE - 10 ? "text-amber-600" : "text-muted-foreground"
              )}>
                {titleCount}/{MAX_TITLE} characters
              </div>
            </div>

            <div className="space-y-2">
              <Label>Body</Label>
              <textarea
                className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background text-sm resize-none"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value.slice(0, MAX_BODY) })}
                placeholder="Hi {{first_name}}, don't lose access to your data!"
              />
              <div className={cn(
                "text-xs",
                bodyCount > MAX_BODY ? "text-red-500" : bodyCount > MAX_BODY - 20 ? "text-amber-600" : "text-muted-foreground"
              )}>
                {bodyCount}/{MAX_BODY} characters
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon URL (optional)</Label>
                <Input
                  value={formData.icon_url}
                  onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
                  placeholder="https://example.com/icon.png"
                />
              </div>
              <div className="space-y-2">
                <Label>CTA URL (optional)</Label>
                <Input
                  value={formData.cta_url}
                  onChange={(e) => setFormData({ ...formData, cta_url: e.target.value })}
                  placeholder="https://myapp.com/dashboard"
                />
              </div>
            </div>

            {/* Live Preview */}
            <div className="space-y-2">
              <Label>Live Preview</Label>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 border">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                    <Bell className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{previewText.title || 'Notification Title'}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{previewText.body || 'Notification body text goes here...'}</div>
                    <div className="text-xs text-muted-foreground mt-1">product_name</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Variables (comma-separated)</Label>
              <Input
                value={formData.variables}
                onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
                placeholder="first_name, product_name, product_url"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSave} 
              disabled={!formData.name || !formData.title || !formData.body || createTemplate.isPending || updateTemplate.isPending}
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