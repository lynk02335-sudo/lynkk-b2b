import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTemplates, useUseTemplate } from '@/hooks/use-templates'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { LayoutTemplate, MessageCircle, Mail, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

const CATEGORIES = ['Reactivation', 'Onboarding', 'Referral', 'Upsell', 'Alert'] as const

const categoryIcon: Record<string, typeof LayoutTemplate> = {
  Reactivation: MessageCircle,
  Onboarding: LayoutTemplate,
  Referral: Mail,
  Upsell: LayoutTemplate,
  Alert: AlertTriangle,
}

const channelIcon: Record<string, typeof MessageCircle> = {
  WhatsApp: MessageCircle,
  Email: Mail,
  Slack: MessageCircle,
}

export default function TemplatesPage() {
  const navigate = useNavigate()
  const { data: templates, isLoading, isError, error } = useTemplates()
  const useTemplate = useUseTemplate()
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const filteredTemplates = activeCategory
    ? templates?.filter((t) => t.category === activeCategory)
    : templates

  const handleUseTemplate = async (templateId: string) => {
    try {
      await useTemplate.mutateAsync(templateId)
      navigate('/workflows/new')
    } catch {
      toast.error('Failed to apply template. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-64" />
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-9 w-32" />
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-64 w-full" />
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
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Failed to load templates</p>
              <p className="text-sm">{(error as Error)?.message || 'An unexpected error occurred. Please try again later.'}</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Workflow Templates</h1>
          <p className="text-muted-foreground">Choose a template to get started with your workflow</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory(null)}
          >
            All Templates
          </Button>
          {CATEGORIES.map((category) => (
            <Button
              key={category}
              variant={activeCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>

        {filteredTemplates && filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <LayoutTemplate className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No templates found</h3>
            <p className="text-muted-foreground">
              {activeCategory
                ? `No templates in the "${activeCategory}" category yet.`
                : 'No workflow templates are available yet.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates?.map((template) => {
              const Icon = categoryIcon[template.category] || LayoutTemplate
              return (
                <Card key={template.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <Badge variant="secondary">{template.category}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <CardDescription className="mb-4">
                      {template.description}
                    </CardDescription>
                    {template.rate && (
                      <p className="text-sm mb-4">
                        <span className="font-medium">Recovery rate:</span>{' '}
                        {template.rate}
                      </p>
                    )}
                    {template.channels && template.channels.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {template.channels.map((channel) => {
                          const ChannelIcon = channelIcon[channel]
                          return (
                            <Badge key={channel} variant="outline" className="flex items-center gap-1">
                              {ChannelIcon && <ChannelIcon className="h-3 w-3" />}
                              {channel}
                            </Badge>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="bg-indigo-600 hover:bg-indigo-700 w-full"
                      size="sm"
                      onClick={() => handleUseTemplate(template.id)}
                      disabled={useTemplate.isPending}
                    >
                      Use Template
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground">
          <Link to="/workflows" className="hover:underline">Back to workflows</Link>
        </div>
      </div>
    </DashboardLayout>
  )
}
