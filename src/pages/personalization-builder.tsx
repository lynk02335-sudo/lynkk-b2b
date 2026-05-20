import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { usePersonalizationCampaigns, useUpdatePersonalizationCampaign, type PersonalizationCampaign } from '@/hooks/use-personalization-campaigns'
import { DashboardLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, Loader2, Eye, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const TRIGGERS = [
  { value: 'page_load', label: 'On Page Load' },
  { value: 'exit_intent', label: 'On Exit Intent' },
  { value: 'scroll_50', label: 'On 50% Scroll' },
  { value: 'time_on_page_30s', label: 'After 30 seconds' },
  { value: 'element_click', label: 'On Element Click' },
]

const URL_MATCH_TYPES = [
  { value: 'contains', label: 'Contains' },
  { value: 'exact', label: 'Exact Match' },
  { value: 'regex', label: 'Regex' },
]

const FREQUENCY_OPTIONS = [
  { value: 'once', label: 'Show Once' },
  { value: 'once_per_session', label: 'Once per Session' },
  { value: 'always', label: 'Always' },
]

const POSITIONS = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'center', label: 'Center' },
  { value: 'bottom-right', label: 'Bottom Right' },
]

const USER_PROPERTIES = [
  { value: 'status', label: 'User Status' },
  { value: 'plan', label: 'Plan' },
  { value: 'events_count', label: 'Events Count' },
  { value: 'last_active_days', label: 'Days Since Last Active' },
]

const OPERATORS = [
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'gte', label: 'Greater than or equal' },
  { value: 'lte', label: 'Less than or equal' },
  { value: 'gt', label: 'Greater than' },
  { value: 'lt', label: 'Less than' },
]

interface TargetingCondition {
  id: string
  property: string
  operator: string
  value: string
}

export default function PersonalizationBuilderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: campaigns, isLoading } = usePersonalizationCampaigns()
  const updateCampaign = useUpdatePersonalizationCampaign()

  const campaign = campaigns?.find((c: PersonalizationCampaign) => c.id === id)

  const [formData, setFormData] = useState({
    name: '',
    type: 'BANNER' as 'BANNER' | 'MODAL' | 'TOOLTIP' | 'INLINE',
    status: 'DRAFT' as string,
    content: {
      headline: '',
      body: '',
      cta_text: '',
      cta_url: '',
      image_url: '',
      theme: 'light',
      position: 'bottom',
    },
    targeting_rules: {
      operator: 'AND',
      conditions: [] as TargetingCondition[],
    },
    display_rules: {
      trigger: 'page_load',
      url_match: 'contains',
      url_pattern: '',
      frequency: 'once',
      delay_seconds: 0,
    },
    priority: 0,
  })

  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('content')

  useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        content: {
          headline: campaign.content?.headline || '',
          body: campaign.content?.body || '',
          cta_text: campaign.content?.cta_text || '',
          cta_url: campaign.content?.cta_url || '',
          image_url: campaign.content?.image_url || '',
          theme: campaign.content?.theme || 'light',
          position: campaign.content?.position || 'bottom',
        },
        targeting_rules: {
          operator: (campaign.targeting_rules?.operator as string) || 'AND',
          conditions: (campaign.targeting_rules?.conditions || []).map(
            (c: any) => ({ id: crypto.randomUUID(), property: c.property || '', operator: c.operator || 'eq', value: c.value || '' })
          ),
        },
        display_rules: {
          trigger: (campaign.display_rules?.trigger as string) || 'page_load',
          url_match: (campaign.display_rules?.url_match as string) || 'contains',
          url_pattern: (campaign.display_rules?.url_pattern as string) || '',
          frequency: (campaign.display_rules?.frequency as string) || 'once',
          delay_seconds: (campaign.display_rules?.delay_seconds as number) || 0,
        },
        priority: campaign.priority || 0,
      })
    }
  }, [campaign])

  const handleSave = async (newStatus?: string) => {
    setSaving(true)
    try {
      await updateCampaign.mutateAsync({
        id: id!,
        name: formData.name,
        status: newStatus as any || formData.status,
        content: formData.content,
        targeting_rules: formData.targeting_rules,
        display_rules: formData.display_rules,
        priority: formData.priority,
      })
      toast.success('Campaign saved')
      if (newStatus === 'ACTIVE') {
        navigate('/personalization')
      }
    } catch {
      toast.error('Failed to save campaign')
    }
    setSaving(false)
  }

  const addCondition = () => {
    setFormData({
      ...formData,
      targeting_rules: {
        ...formData.targeting_rules,
        conditions: [
          ...formData.targeting_rules.conditions,
          { id: crypto.randomUUID(), property: 'status', operator: 'eq', value: '' },
        ],
      },
    })
  }

  const removeCondition = (id: string) => {
    setFormData({
      ...formData,
      targeting_rules: {
        ...formData.targeting_rules,
        conditions: formData.targeting_rules.conditions.filter(c => c.id !== id),
      },
    })
  }

  const updateCondition = (id: string, field: string, value: string) => {
    setFormData({
      ...formData,
      targeting_rules: {
        ...formData.targeting_rules,
        conditions: formData.targeting_rules.conditions.map(c =>
          c.id === id ? { ...c, [field]: value } : c
        ),
      },
    })
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <Skeleton className="h-10 w-64 mb-8" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    )
  }

  if (!campaign) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <p>Campaign not found</p>
          <Link to="/personalization"><Button variant="outline">Back to Campaigns</Button></Link>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b bg-white">
          <div className="flex items-center gap-4">
            <Link to="/personalization">
              <Button variant="ghost" size="icon">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="text-xl font-semibold border-none focus-visible:ring-0"
              placeholder="Campaign name"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleSave()} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Draft
            </Button>
            {formData.status !== 'ACTIVE' && (
              <Button onClick={() => handleSave('ACTIVE')} disabled={saving}>
                Activate
              </Button>
            )}
          </div>
        </header>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
          <div className="border-b px-6">
            <TabsList>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="targeting">Targeting</TabsTrigger>
              <TabsTrigger value="display">Display Rules</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            {/* Content Tab */}
            <TabsContent value="content" className="space-y-6 mt-0">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Headline</Label>
                    <Input
                      value={formData.content.headline}
                      onChange={(e) => setFormData({ ...formData, content: { ...formData.content, headline: e.target.value } })}
                      placeholder="You're almost there!"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Body Text</Label>
                    <textarea
                      className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-sm resize-none"
                      value={formData.content.body}
                      onChange={(e) => setFormData({ ...formData, content: { ...formData.content, body: e.target.value } })}
                      placeholder="Upgrade now to unlock more features"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>CTA Text</Label>
                      <Input
                        value={formData.content.cta_text}
                        onChange={(e) => setFormData({ ...formData, content: { ...formData.content, cta_text: e.target.value } })}
                        placeholder="Upgrade Now"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CTA URL</Label>
                      <Input
                        value={formData.content.cta_url}
                        onChange={(e) => setFormData({ ...formData, content: { ...formData.content, cta_url: e.target.value } })}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Image URL (optional)</Label>
                    <Input
                      value={formData.content.image_url}
                      onChange={(e) => setFormData({ ...formData, content: { ...formData.content, image_url: e.target.value } })}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Theme</Label>
                      <Select
                        value={formData.content.theme}
                        onValueChange={(v) => setFormData({ ...formData, content: { ...formData.content, theme: v } })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Position</Label>
                      <Select
                        value={formData.content.position}
                        onValueChange={(v) => setFormData({ ...formData, content: { ...formData.content, position: v } })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {POSITIONS.map(p => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Live Preview */}
                <div>
                  <Label className="mb-2 block">Preview</Label>
                  <div className={cn(
                    "border-2 border-dashed rounded-lg p-4 min-h-[300px] relative",
                    formData.content.theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-white'
                  )}>
                    {formData.type === 'BANNER' && (
                      <div className={cn(
                        "absolute left-0 right-0 p-4 flex items-center justify-between",
                        formData.content.position === 'top' ? 'top-0' : 'bottom-0',
                        formData.content.theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'
                      )}>
                        <div>
                          <div className="font-semibold">{formData.content.headline || 'Headline'}</div>
                          <div className="text-sm opacity-80">{formData.content.body || 'Body text'}</div>
                        </div>
                        <Button size="sm">{formData.content.cta_text || 'CTA'}</Button>
                      </div>
                    )}
                    {formData.type === 'MODAL' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <div className={cn(
                          "p-6 rounded-lg max-w-sm",
                          formData.content.theme === 'dark' ? 'bg-slate-700' : 'bg-white'
                        )}>
                          {formData.content.image_url && (
                            <img src={formData.content.image_url} alt="" className="w-full h-32 object-cover rounded mb-4" />
                          )}
                          <div className="font-semibold text-lg mb-2">{formData.content.headline || 'Headline'}</div>
                          <div className="text-sm opacity-80 mb-4">{formData.content.body || 'Body text'}</div>
                          <Button className="w-full">{formData.content.cta_text || 'CTA'}</Button>
                        </div>
                      </div>
                    )}
                    {!formData.type && <div className="text-center text-muted-foreground">Select a campaign type</div>}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Targeting Tab */}
            <TabsContent value="targeting" className="space-y-6 mt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Logic</Label>
                  <Select
                    value={formData.targeting_rules.operator}
                    onValueChange={(v) => setFormData({
                      ...formData,
                      targeting_rules: { ...formData.targeting_rules, operator: v }
                    })}
                  >
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">Match ALL</SelectItem>
                      <SelectItem value="OR">Match ANY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.targeting_rules.conditions.map((condition) => (
                  <div key={condition.id} className="flex gap-2 items-center">
                    <Select
                      value={condition.property}
                      onValueChange={(v) => updateCondition(condition.id, 'property', v)}
                    >
                      <SelectTrigger className="w-40"><SelectValue placeholder="Property" /></SelectTrigger>
                      <SelectContent>
                        {USER_PROPERTIES.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={condition.operator}
                      onValueChange={(v) => updateCondition(condition.id, 'operator', v)}
                    >
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={condition.value}
                      onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                      placeholder="Value"
                      className="flex-1"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeCondition(condition.id)}>
                      <Zap className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}

                <Button variant="outline" onClick={addCondition}>
                  Add Condition
                </Button>
              </div>
            </TabsContent>

            {/* Display Rules Tab */}
            <TabsContent value="display" className="space-y-6 mt-0">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Trigger</Label>
                    <Select
                      value={formData.display_rules.trigger}
                      onValueChange={(v) => setFormData({
                        ...formData,
                        display_rules: { ...formData.display_rules, trigger: v }
                      })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TRIGGERS.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>URL Match Type</Label>
                    <Select
                      value={formData.display_rules.url_match}
                      onValueChange={(v) => setFormData({
                        ...formData,
                        display_rules: { ...formData.display_rules, url_match: v }
                      })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {URL_MATCH_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>URL Pattern</Label>
                    <Input
                      value={formData.display_rules.url_pattern}
                      onChange={(e) => setFormData({
                        ...formData,
                        display_rules: { ...formData.display_rules, url_pattern: e.target.value }
                      })}
                      placeholder="/dashboard"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select
                      value={formData.display_rules.frequency}
                      onValueChange={(v) => setFormData({
                        ...formData,
                        display_rules: { ...formData.display_rules, frequency: v }
                      })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FREQUENCY_OPTIONS.map(f => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Delay (seconds)</Label>
                    <Input
                      type="number"
                      value={formData.display_rules.delay_seconds}
                      onChange={(e) => setFormData({
                        ...formData,
                        display_rules: { ...formData.display_rules, delay_seconds: parseInt(e.target.value) || 0 }
                      })}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="mt-0">
              <div className="text-center py-12 text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Preview will show how the campaign looks on a real page</p>
                <p className="text-sm mt-2">This requires the JS SDK to be installed on your website</p>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}