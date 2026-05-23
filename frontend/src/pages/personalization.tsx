import { useState, useEffect } from 'react'
import { usePersonalizationCampaigns, useCreatePersonalizationCampaign, useUpdatePersonalizationCampaign, useDeletePersonalizationCampaign, type PersonalizationCampaign } from '@/hooks/use-personalization-campaigns'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Loader2, Layout, MessageSquare, MousePointer, Code, Zap, ThumbsUp, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

type CampaignType = 'BANNER' | 'MODAL' | 'TOOLTIP' | 'INLINE' | 'RECOMMENDATIONS'
type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'

const CAMPAIGN_TYPES = [
  { value: 'BANNER', label: 'Banner', icon: Layout, description: 'Fixed bar at top or bottom' },
  { value: 'MODAL', label: 'Modal', icon: MessageSquare, description: 'Centered popup overlay' },
  { value: 'TOOLTIP', label: 'Tooltip', icon: MousePointer, description: 'Floating tooltip near elements' },
  { value: 'INLINE', label: 'Inline', icon: Code, description: 'Replace content on page' },
  { value: 'RECOMMENDATIONS', label: 'Recommendations', icon: ThumbsUp, description: 'Product/feature recommendation grid' },
]

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  ACTIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-yellow-100 text-yellow-800',
  ARCHIVED: 'bg-slate-100 text-slate-800',
}

export default function PersonalizationPage() {
  const navigate = useNavigate()
  const { data: campaigns, isLoading, isError, error } = usePersonalizationCampaigns()
  const createCampaign = useCreatePersonalizationCampaign()
  const updateCampaign = useUpdatePersonalizationCampaign()
  const deleteCampaign = useDeletePersonalizationCampaign()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    type: 'BANNER' as CampaignType,
  })
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [filterType, setFilterType] = useState<string>('ALL')
  const [statsMap, setStatsMap] = useState<Record<string, { impressions: number; clicks: number; ctr: number }>>({})

  // Fetch stats for all campaigns
  useEffect(() => {
    if (!campaigns || campaigns.length === 0) return
    const fetchStats = async () => {
      const map: Record<string, { impressions: number; clicks: number; ctr: number }> = {}
      await Promise.all(campaigns.map(async (c) => {
        try {
          const data = await api.get<any>(`/api/personalization-campaigns/${c.id}/stats`)
          map[c.id] = data
        } catch {}
      }))
      setStatsMap(map)
    }
    fetchStats()
  }, [campaigns])

  const filtered = (campaigns || []).filter(c => {
    if (filterStatus !== 'ALL' && c.status !== filterStatus) return false
    if (filterType !== 'ALL' && c.type !== filterType) return false
    return true
  })

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a campaign name')
      return
    }
    try {
      const result: PersonalizationCampaign = await createCampaign.mutateAsync({
        name: formData.name,
        type: formData.type,
      })
      toast.success('Campaign created')
      setDialogOpen(false)
      setFormData({ name: '', type: 'BANNER' })
      navigate(`/personalization/${result.id}/edit`)
    } catch {
      toast.error('Failed to create campaign')
    }
  }

  const handleStatusChange = async (id: string, status: CampaignStatus) => {
    try {
      await updateCampaign.mutateAsync({ id, status })
      toast.success(`Campaign ${status.toLowerCase()}`)
    } catch {
      toast.error('Failed to update campaign')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this campaign?')) return
    try {
      await deleteCampaign.mutateAsync(id)
      delete statsMap[id]
      toast.success('Campaign deleted')
    } catch {
      toast.error('Failed to delete campaign')
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-8 w-96" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    )
  }

  if (isError) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <Zap className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Failed to load campaigns</p>
              <p className="text-sm">{(error as Error)?.message || 'An unexpected error occurred.'}</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Personalization Campaigns</h1>
            <p className="text-muted-foreground">Create banners, modals, and popups for your users</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="PAUSED">Paused</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              {CAMPAIGN_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filtered.length} campaign{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Zap className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No campaigns found</h3>
            <p className="text-muted-foreground mb-4">
              {campaigns && campaigns.length > 0
                ? 'Try changing your filters'
                : 'Create your first personalization campaign'}
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {filtered.length} campaign{filtered.length !== 1 ? 's' : ''}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 pr-4 font-medium">Name</th>
                      <th className="pb-3 pr-4 font-medium">Type</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 pr-4 font-medium text-right">Impressions</th>
                      <th className="pb-3 pr-4 font-medium text-right">Clicks</th>
                      <th className="pb-3 pr-4 font-medium text-right">CTR</th>
                      <th className="pb-3 pr-4 font-medium">Last Modified</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((campaign: PersonalizationCampaign) => {
                      const TypeIcon = CAMPAIGN_TYPES.find(t => t.value === campaign.type)?.icon || Layout
                      const stats = statsMap[campaign.id]
                      return (
                        <tr key={campaign.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                                <TypeIcon className="h-4 w-4 text-primary" />
                              </div>
                              <span className="font-medium">{campaign.name}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <Badge variant="outline">{campaign.type}</Badge>
                          </td>
                          <td className="py-3 pr-4">
                            <Badge className={STATUS_COLORS[campaign.status || 'DRAFT']}>
                              {campaign.status || 'DRAFT'}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums">
                            {stats ? (stats.impressions || 0).toLocaleString() : '-'}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums">
                            {stats ? (stats.clicks || 0).toLocaleString() : '-'}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums">
                            {stats ? `${stats.ctr}%` : '-'}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {campaign.updated_at
                              ? new Date(campaign.updated_at).toLocaleDateString()
                              : '-'}
                          </td>
                          <td className="py-3">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => navigate(`/personalization/${campaign.id}/edit`)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              {campaign.status === 'DRAFT' && (
                                <Button size="sm" onClick={() => handleStatusChange(campaign.id, 'ACTIVE')}>
                                  Activate
                                </Button>
                              )}
                              {campaign.status === 'ACTIVE' && (
                                <Button variant="outline" size="sm" onClick={() => handleStatusChange(campaign.id, 'PAUSED')}>
                                  Pause
                                </Button>
                              )}
                              {campaign.status === 'PAUSED' && (
                                <Button size="sm" onClick={() => handleStatusChange(campaign.id, 'ACTIVE')}>
                                  Resume
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600"
                                onClick={() => handleDelete(campaign.id)}
                                disabled={deleteCampaign.isPending}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Campaign</DialogTitle>
            <DialogDescription>
              Choose a campaign type to get started
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Trial Upgrade Prompt"
              />
            </div>

            <div className="space-y-2">
              <Label>Campaign Type</Label>
              <div className="grid grid-cols-2 gap-3">
                {CAMPAIGN_TYPES.map((type) => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: type.value as CampaignType })}
                      className={cn(
                        "p-4 rounded-lg border-2 text-left transition-all",
                        formData.type === type.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <Icon className="h-5 w-5 mb-2" />
                      <div className="font-medium text-sm">{type.label}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.name || createCampaign.isPending}
            >
              {createCampaign.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
