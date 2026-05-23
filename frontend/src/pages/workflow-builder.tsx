import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useWorkflowBuilderStore } from '@/stores/workflow-builder'
import type { BuilderNode } from '@/stores/workflow-builder'
import { useWorkflow, useCreateWorkflow, useUpdateWorkflow } from '@/hooks/use-workflows'
import { useSmsTemplates } from '@/hooks/use-sms-templates'
import { usePushTemplates } from '@/hooks/use-push-templates'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { WorkflowStep, WorkflowCondition, ExitCondition, SimulationResult } from '@/types'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  ChevronLeft, Plus, Play, Save, Trash2, Zap, Filter, Mail,
  MessageCircle, MessageSquare, Webhook, Timer, Tag, SplitSquareHorizontal, X,
  Smartphone, Bell, ThumbsUp,
} from 'lucide-react'

const TRIGGER_TYPES = [
  { value: 'user.inactive_3d', label: 'User inactive 3 days' },
  { value: 'user.inactive_5d', label: 'User inactive 5 days' },
  { value: 'user.inactive_14d', label: 'User inactive 14 days' },
  { value: 'event.occurred', label: 'Event Occurred' },
  { value: 'event.not_occurred', label: 'Event Not Occurred' },
  { value: 'event.count_reached', label: 'Event Count Reached' },
  { value: 'user.milestone_reached', label: 'Milestone Reached' },
  { value: 'user.trial_expiring', label: 'Trial Expiring' },
  { value: 'schedule.recurring', label: 'Recurring Schedule' },
  { value: 'funnel.drop_off', label: 'Funnel Drop-off' },
] as const

const ACTION_TYPES = [
  { value: 'send_whatsapp', label: 'Send WhatsApp', icon: MessageCircle, color: 'bg-green-500' },
  { value: 'send_email', label: 'Send Email', icon: Mail, color: 'bg-blue-500' },
  { value: 'send_sms', label: 'Send SMS', icon: Smartphone, color: 'bg-emerald-500' },
  { value: 'send_push', label: 'Send Push', icon: Bell, color: 'bg-amber-500' },
  { value: 'send_slack_alert', label: 'Slack Alert', icon: MessageSquare, color: 'bg-purple-500' },
  { value: 'trigger_webhook', label: 'Trigger Webhook', icon: Webhook, color: 'bg-orange-500' },
  { value: 'wait_for_event', label: 'Wait for Event', icon: Timer, color: 'bg-yellow-500' },
  { value: 'update_user', label: 'Update User', icon: Tag, color: 'bg-cyan-500' },
  { value: 'ab_split', label: 'A/B Split', icon: SplitSquareHorizontal, color: 'bg-pink-500' },
  { value: 'send_recommendations', label: 'Send Recommendations', icon: ThumbsUp, color: 'bg-teal-500' },
] as const

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
] as const

const EXIT_TYPES = [
  { value: 'state_changed', label: 'State Changed' },
  { value: 'event_occurred', label: 'Event Occurred' },
] as const

const DELAY_UNITS = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
] as const

const NODE_COLORS: Record<string, string> = {
  trigger: 'bg-indigo-500',
  condition: 'bg-slate-500',
  exit: 'bg-rose-500',
}

const STEP_ACTION_COLORS: Record<string, string> = {
  send_whatsapp: 'bg-green-500',
  send_email: 'bg-blue-500',
  send_sms: 'bg-emerald-500',
  send_push: 'bg-amber-500',
  send_slack_alert: 'bg-purple-500',
  trigger_webhook: 'bg-orange-500',
  wait_for_event: 'bg-yellow-500',
  update_user: 'bg-cyan-500',
  ab_split: 'bg-pink-500',
  send_recommendations: 'bg-teal-500',
}

const ACTION_LABELS: Record<string, string> = {
  send_whatsapp: 'Send WhatsApp',
  send_email: 'Send Email',
  send_sms: 'Send SMS',
  send_push: 'Send Push',
  send_slack_alert: 'Slack Alert',
  trigger_webhook: 'Trigger Webhook',
  wait_for_event: 'Wait for Event',
  update_user: 'Update User',
  ab_split: 'A/B Split',
  send_recommendations: 'Send Recommendations',
}

function getNodeLabel(node: BuilderNode): string {
  if (node.type === 'trigger') return 'Trigger'
  if (node.type === 'condition') return 'Condition'
  if (node.type === 'exit') return 'Exit'
  if (node.step?.action?.type) return ACTION_LABELS[node.step.action.type] || 'Step'
  return 'Step'
}

function getNodeDotColor(node: BuilderNode): string {
  if (node.type === 'step' && node.step?.action?.type) {
    return STEP_ACTION_COLORS[node.step.action.type] || 'bg-gray-400'
  }
  return NODE_COLORS[node.type] || 'bg-gray-400'
}

function getNodeSubtext(node: BuilderNode): string | null {
  if (node.type === 'trigger' && node.trigger?.config?.event_name) {
    return node.trigger.config.event_name as string
  }
  if (node.type === 'step') {
    const config = node.step?.action?.config
    if (config?.template) return config.template as string
    if (config?.event_name) return config.event_name as string
    if (config?.message) return (config.message as string).slice(0, 40)
  }
  return null
}

function hasDelay(node: BuilderNode): boolean {
  return !!(node.step?.delay?.value && node.step.delay.value > 0)
}

// --- PaletteItem ---

function PaletteItem({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: React.ElementType
  label: string
  color: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md border border-border/50 hover:bg-accent hover:text-accent-foreground transition-colors text-left"
    >
      <div className={cn('w-2 h-2 rounded-full shrink-0', color)} />
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span>{label}</span>
    </button>
  )
}

// --- CanvasNode ---

function CanvasNode({
  node,
  isSelected,
  onSelect,
  onDelete,
}: {
  node: BuilderNode
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const dotColor = getNodeDotColor(node)
  const label = getNodeLabel(node)
  const subtext = getNodeSubtext(node)

  return (
    <div
      onClick={onSelect}
      className={cn(
        'relative flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer transition-all',
        'hover:border-indigo-300 group',
        isSelected ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-border',
      )}
    >
      <div className={cn('w-3 h-3 rounded-full shrink-0', dotColor)} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {hasDelay(node) && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 font-medium leading-none">
              {node.step!.delay.value} {node.step!.delay.unit}
            </span>
          )}
        </div>
        {subtext && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{subtext}</p>
        )}
      </div>

      {node.type !== 'trigger' && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

// --- TriggerConfig ---

function TriggerConfig({ node }: { node: BuilderNode }) {
  const { updateNode } = useWorkflowBuilderStore()
  const trigger = node.trigger || { type: 'event.occurred', config: {} }
  const config = trigger.config || {}

  const { data: funnels } = useQuery({
    queryKey: ['funnels'],
    queryFn: () => api.get<any[]>('/api/funnels'),
    enabled: trigger.type === 'funnel.drop_off',
  })

  const selectedFunnel = funnels?.find((f: any) => f.id === config.funnel_id)

  const setTriggerType = (type: string) => {
    updateNode(node.id, { trigger: { ...trigger, type, config: {} } })
  }

  const setConfig = (key: string, value: unknown) => {
    updateNode(node.id, {
      trigger: { ...trigger, config: { ...config, [key]: value } },
    })
  }

  const needsEventName = ['event.occurred', 'event.not_occurred', 'event.count_reached'].includes(trigger.type)
  const needsCount = trigger.type === 'event.count_reached'
  const needsCron = trigger.type === 'schedule.recurring'
  const needsFunnel = trigger.type === 'funnel.drop_off'

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Trigger Type</Label>
        <Select value={trigger.type} onValueChange={setTriggerType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {needsEventName && (
        <div className="space-y-2">
          <Label>Event Name</Label>
          <Input
            value={(config.event_name as string) || ''}
            onChange={(e) => setConfig('event_name', e.target.value)}
            placeholder="e.g. user.login"
          />
        </div>
      )}

      {needsCount && (
        <div className="space-y-2">
          <Label>Count</Label>
          <Input
            type="number"
            min={1}
            value={(config.count as string) || ''}
            onChange={(e) => setConfig('count', parseInt(e.target.value) || 1)}
          />
        </div>
      )}

      {needsCron && (
        <div className="space-y-2">
          <Label>Cron Expression</Label>
          <Input
            value={(config.cron as string) || ''}
            onChange={(e) => setConfig('cron', e.target.value)}
            placeholder="0 9 * * 1"
          />
          <p className="text-xs text-muted-foreground">Cron syntax for scheduling</p>
        </div>
      )}

      {needsFunnel && (
        <>
          <div className="space-y-2">
            <Label>Funnel</Label>
            <Select value={config.funnel_id as string || ''} onValueChange={(v) => {
              updateNode(node.id, {
                trigger: { ...trigger, config: { ...config, funnel_id: v, dropoff_step_index: '' } },
              })
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select funnel" />
              </SelectTrigger>
              <SelectContent>
                {(funnels || []).map((f: any) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedFunnel && (
            <div className="space-y-2">
              <Label>Drop-off Step</Label>
              <Select value={String(config.dropoff_step_index ?? '')} onValueChange={(v) => setConfig('dropoff_step_index', parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select step" />
                </SelectTrigger>
                <SelectContent>
                  {selectedFunnel.steps.slice(0, -1).map((step: string, i: number) => (
                    <SelectItem key={i} value={String(i)}>
                      After step {i}: {step}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Wait Window</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="w-24"
                value={(config.wait_window_hours as number) || 24}
                onChange={(e) => setConfig('wait_window_hours', parseInt(e.target.value) || 24)}
              />
              <span className="text-sm text-muted-foreground">hours</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// --- ConditionConfig ---

function ConditionConfig({ node }: { node: BuilderNode }) {
  const { updateNode } = useWorkflowBuilderStore()
  const condition = node.condition || { field: '', operator: 'equals', value: '', if_true: 'continue', if_false: 'continue' }

  const setField = (field: string) => {
    updateNode(node.id, { condition: { ...condition, field } })
  }

  const setOperator = (operator: string) => {
    updateNode(node.id, { condition: { ...condition, operator } })
  }

  const setValue = (value: string) => {
    updateNode(node.id, { condition: { ...condition, value } })
  }

  const setOnTrue = (action: string) => {
    updateNode(node.id, { condition: { ...condition, if_true: action } })
  }

  const setOnFalse = (action: string) => {
    updateNode(node.id, { condition: { ...condition, if_false: action } })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Field</Label>
        <Input
          value={condition.field}
          onChange={(e) => setField(e.target.value)}
          placeholder="e.g. user.plan"
        />
      </div>

      <div className="space-y-2">
        <Label>Operator</Label>
        <Select value={condition.operator} onValueChange={setOperator}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATORS.map((op) => (
              <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Value</Label>
        <Input
          value={condition.value as string}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. pro"
        />
      </div>

      <div className="space-y-2">
        <Label>If TRUE</Label>
        <Select value={(condition.if_true as string) || 'continue'} onValueChange={setOnTrue}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="continue">Continue to next step</SelectItem>
            <SelectItem value="exit">Exit workflow</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>If FALSE</Label>
        <Select value={(condition.if_false as string) || 'continue'} onValueChange={setOnFalse}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="continue">Continue to next step</SelectItem>
            <SelectItem value="exit">Exit workflow</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// --- Common Variables Hints ---

function VariableHints({ onInsert }: { onInsert: (varName: string) => void }) {
  const vars = ['user_name', 'product_name', 'first_name', 'last_name', 'days_inactive', 'plan', 'company_name']
  return (
    <div className="flex flex-wrap gap-1">
      {vars.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onInsert(v)}
          className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
        >
          {'{{'}{v}{'}}'}
        </button>
      ))}
    </div>
  )
}

// --- StepConfig ---

function StepConfig({ node }: { node: BuilderNode }) {
  const { updateNode } = useWorkflowBuilderStore()
  const step = node.step || { id: '', delay: { value: 0, unit: 'hours' as const }, action: { type: '', config: {} } }
  const actionConfig = step.action.config || {}
  const { data: smsTemplates } = useSmsTemplates()
  const { data: pushTemplates } = usePushTemplates()

  const setDelayValue = (value: number) => {
    updateNode(node.id, { step: { ...step, delay: { ...step.delay, value } } })
  }

  const setDelayUnit = (unit: 'minutes' | 'hours' | 'days') => {
    updateNode(node.id, { step: { ...step, delay: { ...step.delay, unit } } })
  }

  const setActionType = (type: string) => {
    updateNode(node.id, { step: { ...step, action: { type, config: {} } } })
  }

  const setActionConfig = (key: string, value: unknown) => {
    updateNode(node.id, {
      step: { ...step, action: { ...step.action, config: { ...actionConfig, [key]: value } } },
    })
  }

  const actionType = step.action.type

  const insertVar = (varName: string) => {
    const current = (actionConfig.message as string) || ''
    setActionConfig('message', current + `{{${varName}}}`)
  }

  const insertEmailVar = (varName: string) => {
    const current = (actionConfig.body as string) || ''
    setActionConfig('body', current + `{{${varName}}}`)
  }

  const insertPushVar = (varName: string) => {
    const current = (actionConfig.body as string) || ''
    setActionConfig('body', current + `{{${varName}}}`)
  }

  const WA_PROVIDERS = [
    { value: '360dialog', label: '360dialog' },
    { value: 'twilio', label: 'Twilio' },
    { value: 'wati', label: 'Wati' },
    { value: 'aisensy', label: 'AiSensy' },
    { value: 'interakt', label: 'Interakt' },
    { value: 'meta_cloud', label: 'Meta Cloud' },
    { value: 'other', label: 'Other' },
  ]

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Delay</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            value={step.delay.value}
            onChange={(e) => setDelayValue(parseInt(e.target.value) || 0)}
            className="w-20"
          />
          <Select value={step.delay.unit} onValueChange={(v) => setDelayUnit(v as 'minutes' | 'hours' | 'days')}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DELAY_UNITS.map((u) => (
                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Action</Label>
        <Select value={actionType} onValueChange={setActionType}>
          <SelectTrigger>
            <SelectValue placeholder="Select action type" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_TYPES.map((a) => (
              <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {actionType === 'send_whatsapp' && (
        <>
          <div className="space-y-2">
            <Label>WhatsApp Provider</Label>
            <Select
              value={(actionConfig.provider as string) || '360dialog'}
              onValueChange={(v) => setActionConfig('provider', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WA_PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Template Name</Label>
            <Input
              value={(actionConfig.template as string) || ''}
              onChange={(e) => setActionConfig('template', e.target.value)}
              placeholder="e.g. welcome_template"
            />
          </div>
          <div className="space-y-2">
            <Label>Message Body</Label>
            <textarea
              className="w-full min-h-[80px] p-2 rounded-md border border-input bg-background text-sm resize-none"
              value={(actionConfig.message as string) || ''}
              onChange={(e) => setActionConfig('message', e.target.value)}
              placeholder="Hi {{user_name}}, check out {{product_name}}!"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Variables</Label>
            <VariableHints onInsert={insertVar} />
          </div>
          <div className="space-y-2">
            <Label>Phone Number Source</Label>
            <Select
              value={(actionConfig.phone_field as string) || 'phone'}
              onValueChange={(v) => setActionConfig('phone_field', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">tracked_user.phone</SelectItem>
                <SelectItem value="phone_number">tracked_user.phone_number</SelectItem>
                <SelectItem value="mobile">tracked_user.mobile</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fallback (if phone missing)</Label>
            <Select
              value={(actionConfig.fallback as string) || 'skip'}
              onValueChange={(v) => setActionConfig('fallback', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">Skip silently</SelectItem>
                <SelectItem value="email">Send email instead</SelectItem>
                <SelectItem value="stop">Stop workflow</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {actionType === 'send_email' && (
        <>
          <div className="space-y-2">
            <Label>Email Provider</Label>
            <Select
              value={(actionConfig.email_provider as string) || 'resend'}
              onValueChange={(v) => setActionConfig('email_provider', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resend">Resend</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>From Name</Label>
            <Input
              value={(actionConfig.from_name as string) || ''}
              onChange={(e) => setActionConfig('from_name', e.target.value)}
              placeholder="e.g. Acme Team"
            />
          </div>
          <div className="space-y-2">
            <Label>From Email</Label>
            <Input
              value={(actionConfig.from_email as string) || ''}
              onChange={(e) => setActionConfig('from_email', e.target.value)}
              placeholder="hello@yourcompany.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Subject Line</Label>
            <Input
              value={(actionConfig.subject as string) || ''}
              onChange={(e) => setActionConfig('subject', e.target.value)}
              placeholder="Your trial is ending soon"
            />
          </div>
          <div className="space-y-2">
            <Label>Email Template</Label>
            <Input
              value={(actionConfig.template as string) || ''}
              onChange={(e) => setActionConfig('template', e.target.value)}
              placeholder="Template name or ID"
            />
          </div>
          <div className="space-y-2">
            <Label>Body / Preview Text</Label>
            <textarea
              className="w-full min-h-[100px] p-2 rounded-md border border-input bg-background text-sm resize-none"
              value={(actionConfig.body as string) || ''}
              onChange={(e) => setActionConfig('body', e.target.value)}
              placeholder="Hi {{first_name}}, we noticed you haven't used {{product_name}} recently..."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Variables</Label>
            <VariableHints onInsert={insertEmailVar} />
          </div>
          <div className="space-y-2">
            <Label>Fallback (if email missing)</Label>
            <Select
              value={(actionConfig.fallback as string) || 'skip'}
              onValueChange={(v) => setActionConfig('fallback', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">Skip silently</SelectItem>
                <SelectItem value="whatsapp">Send WhatsApp instead</SelectItem>
                <SelectItem value="stop">Stop workflow</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {actionType === 'send_sms' && (
        <>
          <div className="space-y-2">
            <Label>Template</Label>
            <Select
              value={(actionConfig.template_id as string) || ''}
              onValueChange={(v) => setActionConfig('template_id', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom Message</SelectItem>
                {(smsTemplates || []).map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(actionConfig.template_id as string) === 'custom' && (
            <div className="space-y-2">
              <Label>Message</Label>
              <textarea
                className="w-full min-h-[80px] p-2 rounded-md border border-input bg-background text-sm resize-none"
                value={(actionConfig.message as string) || ''}
                onChange={(e) => setActionConfig('message', e.target.value)}
                placeholder="Hi {{first_name}}, your trial ends soon!"
              />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Variables</Label>
                <VariableHints onInsert={insertVar} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Phone Number Source</Label>
            <Select
              value={(actionConfig.phone_field as string) || 'phone'}
              onValueChange={(v) => setActionConfig('phone_field', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">tracked_user.phone</SelectItem>
                <SelectItem value="phone_number">tracked_user.phone_number</SelectItem>
                <SelectItem value="mobile">tracked_user.mobile</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fallback (if phone missing)</Label>
            <Select
              value={(actionConfig.fallback as string) || 'skip'}
              onValueChange={(v) => setActionConfig('fallback', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">Skip silently</SelectItem>
                <SelectItem value="email">Send email instead</SelectItem>
                <SelectItem value="stop">Stop workflow</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {actionType === 'send_push' && (
        <>
          <div className="space-y-2">
            <Label>Push Template</Label>
            <Select
              value={(actionConfig.template_id as string) || ''}
              onValueChange={(v) => setActionConfig('template_id', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom Push</SelectItem>
                {(pushTemplates || []).map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Push Title</Label>
            <Input
              value={(actionConfig.title as string) || ''}
              onChange={(e) => setActionConfig('title', e.target.value)}
              placeholder="Your trial is ending"
            />
          </div>
          <div className="space-y-2">
            <Label>Push Body</Label>
            <textarea
              className="w-full min-h-[60px] p-2 rounded-md border border-input bg-background text-sm resize-none"
              value={(actionConfig.body as string) || ''}
              onChange={(e) => setActionConfig('body', e.target.value)}
              placeholder="Hi {{first_name}}, don't lose access!"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Variables</Label>
            <VariableHints onInsert={insertPushVar} />
          </div>
          <div className="space-y-2">
            <Label>Icon URL (optional)</Label>
            <Input
              value={(actionConfig.icon_url as string) || ''}
              onChange={(e) => setActionConfig('icon_url', e.target.value)}
              placeholder="https://example.com/icon.png"
            />
          </div>
          <div className="space-y-2">
            <Label>Deep Link / URL on Click</Label>
            <Input
              value={(actionConfig.cta_url as string) || ''}
              onChange={(e) => setActionConfig('cta_url', e.target.value)}
              placeholder="https://myapp.com/dashboard"
            />
          </div>
          <div className="space-y-2">
            <Label>Target Platform</Label>
            <Select
              value={(actionConfig.target_platform as string) || 'both'}
              onValueChange={(v) => setActionConfig('target_platform', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ios">iOS</SelectItem>
                <SelectItem value="android">Android</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {actionType === 'send_slack_alert' && (
        <>
          <div className="space-y-2">
            <Label>Slack Webhook URL</Label>
            <Input
              value={(actionConfig.webhook_url as string) || ''}
              onChange={(e) => setActionConfig('webhook_url', e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
            />
            <p className="text-xs text-muted-foreground">Leave blank to use the webhook from Settings</p>
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <textarea
              className="w-full min-h-[80px] p-2 rounded-md border border-input bg-background text-sm resize-none"
              value={(actionConfig.message as string) || ''}
              onChange={(e) => setActionConfig('message', e.target.value)}
              placeholder="Alert message"
            />
          </div>
          <div className="space-y-2">
            <Label>Channel (optional)</Label>
            <Input
              value={(actionConfig.channel as string) || ''}
              onChange={(e) => setActionConfig('channel', e.target.value)}
              placeholder="#general"
            />
          </div>
        </>
      )}

      {actionType === 'trigger_webhook' && (
        <>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              value={(actionConfig.url as string) || ''}
              onChange={(e) => setActionConfig('url', e.target.value)}
              placeholder="https://hooks.example.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label>HTTP Method</Label>
            <Select
              value={(actionConfig.method as string) || 'POST'}
              onValueChange={(v) => setActionConfig('method', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Headers</Label>
            <div className="space-y-2">
              {((actionConfig.headers as Record<string, string> | undefined) ? Object.entries(actionConfig.headers as Record<string, string>) : []).map(([key, val], i) => (
                <div key={i} className="flex gap-1">
                  <Input
                    value={key}
                    onChange={(e) => {
                      const headers = { ...((actionConfig.headers as Record<string, string>) || {}) };
                      const oldKey = Object.keys(headers)[i];
                      if (oldKey !== undefined) {
                        const val = headers[oldKey];
                        delete headers[oldKey];
                        headers[e.target.value] = val;
                      }
                      setActionConfig('headers', headers);
                    }}
                    placeholder="Header name"
                    className="w-[40%]"
                  />
                  <Input
                    value={val}
                    onChange={(e) => {
                      const headers = { ...((actionConfig.headers as Record<string, string>) || {}) };
                      const keys = Object.keys(headers);
                      headers[keys[i]] = e.target.value;
                      setActionConfig('headers', headers);
                    }}
                    placeholder="Value"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const headers = { ...((actionConfig.headers as Record<string, string>) || {}) };
                      const keys = Object.keys(headers);
                      delete headers[keys[i]];
                      setActionConfig('headers', headers);
                    }}
                    className="h-8 w-8 p-0 shrink-0 text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => {
                const headers = { ...((actionConfig.headers as Record<string, string>) || {}) };
                headers[''] = '';
                setActionConfig('headers', headers);
              }}>
                <Plus className="h-3 w-3 mr-1" /> Add Header
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Body / Payload</Label>
            <textarea
              className="w-full min-h-[100px] p-2 rounded-md border border-input bg-background text-sm font-mono resize-none"
              value={(actionConfig.body as string) || ''}
              onChange={(e) => setActionConfig('body', e.target.value)}
              placeholder='{"event": "user.updated", "data": {}}'
            />
          </div>
        </>
      )}

      {actionType === 'wait_for_event' && (
        <>
          <div className="space-y-2">
            <Label>Event Name</Label>
            <Input
              value={(actionConfig.event_name as string) || ''}
              onChange={(e) => setActionConfig('event_name', e.target.value)}
              placeholder="e.g. invoice.paid"
            />
          </div>
          <div className="space-y-2">
            <Label>Timeout</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min={1}
                value={(actionConfig.timeout_value as number) || (actionConfig.timeout_hours as number) || ''}
                onChange={(e) => setActionConfig('timeout_value', parseInt(e.target.value) || 1)}
                className="w-20"
              />
              <Select
                value={(actionConfig.timeout_unit as string) || 'hours'}
                onValueChange={(v) => setActionConfig('timeout_unit', v)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>On Timeout</Label>
            <Select
              value={(actionConfig.on_timeout as string) || 'exit'}
              onValueChange={(v) => setActionConfig('on_timeout', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="continue">Continue workflow</SelectItem>
                <SelectItem value="exit">Exit workflow</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {actionType === 'update_user' && (
        <>
          <div className="space-y-2">
            <Label>Property Updates</Label>
            {(() => {
              const existingProps = actionConfig.properties as Array<{ field: string; value: string }> | undefined
              const hasNewFormat = existingProps && existingProps.length > 0
              const hasOldFormat = !hasNewFormat && (actionConfig.field as string)
              const props: Array<{ field: string; value: string }> = hasNewFormat
                ? existingProps!
                : hasOldFormat
                  ? [{ field: actionConfig.field as string, value: (actionConfig.value as string) || '' }]
                  : [{ field: '', value: '' }]
              return (
                <>
                  {props.map((prop, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <Input
                          value={prop.field}
                          onChange={(e) => {
                            const newProps = [...props]
                            newProps[i] = { ...newProps[i], field: e.target.value }
                            setActionConfig('properties', newProps)
                          }}
                          placeholder="e.g. state"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Input
                          value={prop.value}
                          onChange={(e) => {
                            const newProps = [...props]
                            newProps[i] = { ...newProps[i], value: e.target.value }
                            setActionConfig('properties', newProps)
                          }}
                          placeholder="e.g. churned"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newProps = [...props]
                          newProps.splice(i, 1)
                          setActionConfig('properties', newProps.length > 0 ? newProps : [{ field: '', value: '' }])
                        }}
                        className="h-8 w-8 p-0 shrink-0 text-red-500 mt-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => {
                    setActionConfig('properties', [...props, { field: '', value: '' }])
                  }}>
                    <Plus className="h-3 w-3 mr-1" /> Add Property
                  </Button>
                </>
              )
            })()}
          </div>
        </>
      )}

      {actionType === 'ab_split' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Variants</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const variants = (actionConfig.variants as any[]) || [];
                const nextId = String.fromCharCode(65 + variants.length);
                setActionConfig('variants', [
                  ...variants,
                  { id: nextId, name: `Variant ${nextId}`, description: '', steps: [] },
                ]);
                const split = { ...((actionConfig.traffic_split as Record<string, number>) || {}) };
                const remaining = 100 - Object.values(split).reduce((s: number, v: any) => s + Number(v), 0);
                split[nextId] = Math.max(0, Math.min(100, remaining));
                setActionConfig('traffic_split', split);
              }}
            >
              + Add Variant
            </Button>
          </div>
          {((actionConfig.variants as any[]) || []).map((variant: any, idx: number) => {
            const split = (actionConfig.traffic_split as Record<string, number>) || {};
            return (
              <div key={variant.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{variant.id}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const variants = ((actionConfig.variants as any[]) || []).filter((_: any, i: number) => i !== idx);
                      const newSplit = { ...split };
                      delete newSplit[variant.id];
                      setActionConfig('variants', variants);
                      setActionConfig('traffic_split', newSplit);
                    }}
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={variant.name}
                    onChange={(e) => {
                      const variants = [...((actionConfig.variants as any[]) || [])];
                      variants[idx] = { ...variants[idx], name: e.target.value };
                      setActionConfig('variants', variants);
                    }}
                    placeholder="Variant name"
                  />
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={split[variant.id] ?? 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setActionConfig('traffic_split', { ...split, [variant.id]: Math.max(0, Math.min(100, val)) });
                      }}
                    />
                    <span className="text-xs text-gray-500">%</span>
                  </div>
                </div>
                <Input
                  value={variant.description || ''}
                  onChange={(e) => {
                    const variants = [...((actionConfig.variants as any[]) || [])];
                    variants[idx] = { ...variants[idx], description: e.target.value };
                    setActionConfig('variants', variants);
                  }}
                  placeholder="Description (optional)"
                />
                <div className="text-xs text-gray-500">
                  {(variant.steps as any[])?.length || 0} step(s) configured
                </div>
              </div>
            );
          })}
          {((actionConfig.variants as any[]) || []).length > 0 && (
            <div className="text-xs text-gray-400">
              Total split: {Object.values((actionConfig.traffic_split as Record<string, number>) || {}).reduce((s: number, v: any) => s + Number(v), 0)}%
            </div>
          )}
        </div>
      )}

      {actionType === 'send_recommendations' && (
        <>
          <div className="space-y-2">
            <Label>Strategy</Label>
            <Select value={(actionConfig.strategy as string) || 'TRENDING'} onValueChange={(v) => setActionConfig('strategy', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VIEWED_TOGETHER">Viewed Together</SelectItem>
                <SelectItem value="SIMILAR_USERS">Similar Users</SelectItem>
                <SelectItem value="TRENDING">Trending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Channel</Label>
            <Select value={(actionConfig.channel as string) || 'email'} onValueChange={(v) => setActionConfig('channel', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="push">Push</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Template for Delivery</Label>
            <Input
              value={(actionConfig.template as string) || ''}
              onChange={(e) => setActionConfig('template', e.target.value)}
              placeholder="Template name or ID"
            />
          </div>
          <div className="space-y-2">
            <Label>Number of Items</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={(actionConfig.item_count as number) || 3}
              onChange={(e) => setActionConfig('item_count', parseInt(e.target.value) || 3)}
            />
          </div>
        </>
      )}
    </div>
  )
}

// --- ExitConfig ---

function ExitConfig({ node }: { node: BuilderNode }) {
  const { updateNode } = useWorkflowBuilderStore()
  const exitCondition = node.exitCondition || { type: 'state_changed', config: {} }
  const config = exitCondition.config || {}

  const setType = (type: string) => {
    updateNode(node.id, { exitCondition: { type, config: {} } })
  }

  const setConfig = (key: string, value: unknown) => {
    updateNode(node.id, {
      exitCondition: { ...exitCondition, config: { ...config, [key]: value } },
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Exit Condition</Label>
        <Select value={exitCondition.type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXIT_TYPES.map((e) => (
              <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {exitCondition.type === 'event_occurred' && (
        <div className="space-y-2">
          <Label>Event Name</Label>
          <Input
            value={(config.event_name as string) || ''}
            onChange={(e) => setConfig('event_name', e.target.value)}
            placeholder="e.g. user.deleted"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Reason / Label (optional)</Label>
        <Input
          value={(config.label as string) || ''}
          onChange={(e) => setConfig('label', e.target.value)}
          placeholder="e.g. User unsubscribed"
        />
      </div>
    </div>
  )
}

// --- ConfigPanel ---

function ConfigPanel({ node }: { node: BuilderNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
        {getNodeLabel(node)} Configuration
      </h3>

      {node.type === 'trigger' && <TriggerConfig node={node} />}
      {node.type === 'condition' && <ConditionConfig node={node} />}
      {node.type === 'step' && <StepConfig node={node} />}
      {node.type === 'exit' && <ExitConfig node={node} />}
    </div>
  )
}

// --- SimulationModal ---

function SimulationModal({
  open,
  onOpenChange,
  onRun,
  result,
  userId,
  onUserIdChange,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRun: () => void
  result: SimulationResult | null
  userId: string
  onUserIdChange: (id: string) => void
  loading: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Simulate Workflow</DialogTitle>
          <DialogDescription>
            Test this workflow against a specific user to see the expected timeline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>User ID</Label>
            <Input
              value={userId}
              onChange={(e) => onUserIdChange(e.target.value)}
              placeholder="Enter a user ID to simulate"
            />
          </div>

          <Button onClick={onRun} disabled={!userId || loading} className="w-full">
            {loading ? (
              <span className="flex items-center gap-2">
                <Zap className="h-4 w-4 animate-pulse" />
                Running...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Run Simulation
              </span>
            )}
          </Button>

          {result && (
            <div className="space-y-2 border rounded-lg p-3 max-h-64 overflow-y-auto">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">Timeline</h4>
              {result.timeline.map((event, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium">{event.type}</p>
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                    {event.timestamp && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- WorkflowBuilderPage ---

export default function WorkflowBuilderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const store = useWorkflowBuilderStore()
  const builderId = id && id !== 'new' ? id : ''
  const { data: existingWorkflow } = useWorkflow(builderId)
  const createWorkflow = useCreateWorkflow()
  const updateWorkflow = useUpdateWorkflow()
  const { toast } = useToast()

  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [simOpen, setSimOpen] = useState(false)
  const [simUserId, setSimUserId] = useState('')
  const [simResult, setSimResult] = useState<SimulationResult | null>(null)
  const [templateId, setTemplateId] = useState('custom')
  // Load existing workflow for editing
  const isNew = !id || id === 'new'
  useEffect(() => {
    if (isNew) {
      store.reset()
      return
    }
  }, [isNew])

  useEffect(() => {
    if (existingWorkflow && !isNew) {
      const config = existingWorkflow.config as any || {}
      store.setName(config?.name || 'Untitled Workflow')
      if (existingWorkflow.type) {
        setTemplateId(existingWorkflow.type)
      }
      const nodes: BuilderNode[] = []

      if (!config || Object.keys(config).length === 0) {
        if (existingWorkflow.type === 'trial_recovery') {
          nodes.push({
            id: 'trigger',
            type: 'trigger',
            trigger: { type: 'user.inactive_5d', config: { days: 5 } }
          })
          nodes.push({
            id: crypto.randomUUID(),
            type: 'step',
            step: {
              id: crypto.randomUUID(),
              delay: { value: 0, unit: 'hours' },
              action: { type: 'send_whatsapp', config: { message: existingWorkflow.whatsapp_message || '' } }
            }
          })
        } else if (existingWorkflow.type === 'onboarding_activation') {
          nodes.push({
            id: 'trigger',
            type: 'trigger',
            trigger: { type: 'user.inactive_1d', config: { days: 1 } }
          })
          nodes.push({
            id: crypto.randomUUID(),
            type: 'step',
            step: {
              id: crypto.randomUUID(),
              delay: { value: 0, unit: 'hours' },
              action: { type: 'send_whatsapp', config: { message: existingWorkflow.whatsapp_message || '' } }
            }
          })
        } else if (existingWorkflow.type === 'silent_churn') {
          nodes.push({
            id: 'trigger',
            type: 'trigger',
            trigger: { type: 'user.inactive_7d', config: { days: 7 } }
          })
        }
        store.setNodes(nodes)
        return
      }

      if (config.trigger) {
        nodes.push({ id: 'trigger', type: 'trigger', trigger: config.trigger })
      }

      if (config.steps) {
        for (const step of config.steps) {
          nodes.push({
            id: step.id,
            type: 'step',
            step: { ...step, delay: step.delay || { value: 0, unit: 'hours' } },
          })
        }
      }

      if (config.exit_conditions) {
        (config.exit_conditions as any[]).forEach((ec: any, i: number) => {
          nodes.push({ id: `exit_${i}`, type: 'exit', exitCondition: ec })
        })
      }

      if (config.conditions) {
        (config.conditions as any[]).forEach((c: any, i: number) => {
          nodes.push({ id: `condition_${i}`, type: 'condition', condition: c })
        })
      }

      if (nodes.length > 0) store.setNodes(nodes)
    }
  }, [existingWorkflow, id])

  const addStepNode = useCallback(() => {
    const newId = crypto.randomUUID()
    const newNode: BuilderNode = {
      id: newId,
      type: 'step',
      step: {
        id: crypto.randomUUID(),
        delay: { value: 0, unit: 'hours' },
        action: { type: '', config: {} },
      },
    }
    store.addNode(newNode)
    store.selectNode(newId)
  }, [store])

  const addStepWithAction = useCallback(
    (actionType: string) => {
      const newId = crypto.randomUUID()
      const newNode: BuilderNode = {
        id: newId,
        type: 'step',
        step: {
          id: crypto.randomUUID(),
          delay: { value: 0, unit: 'hours' },
          action: { type: actionType, config: {} },
        },
      }
      store.addNode(newNode)
      store.selectNode(newId)
    },
    [store],
  )

  const addConditionNode = useCallback(() => {
    const newId = crypto.randomUUID()
    const newNode: BuilderNode = {
      id: newId,
      type: 'condition',
      condition: { field: '', operator: 'equals', value: '', if_true: 'continue', if_false: 'continue' },
    }
    store.addNode(newNode)
    store.selectNode(newId)
  }, [store])

  const addExitNode = useCallback(() => {
    const newId = crypto.randomUUID()
    const newNode: BuilderNode = {
      id: newId,
      type: 'exit',
      exitCondition: { type: 'state_changed', config: {} },
    }
    store.addNode(newNode)
    store.selectNode(newId)
  }, [store])

  const buildWorkflowConfig = useCallback(() => {
    const trigger = store.nodes.find((n) => n.type === 'trigger')?.trigger || { type: 'event.occurred', config: {} }
    const conditions = store.nodes.filter((n) => n.type === 'condition').map((n) => n.condition) as WorkflowCondition[]
    const steps = store.nodes.filter((n) => n.type === 'step').map((n) => n.step) as WorkflowStep[]
    const exitConditions = store.nodes.filter((n) => n.type === 'exit').map((n) => n.exitCondition) as ExitCondition[]

    return {
      id: id || crypto.randomUUID(),
      name: store.name,
      trigger,
      ...(conditions.length > 0 && { conditions }),
      steps,
      ...(exitConditions.length > 0 && { exit_conditions: exitConditions }),
    }
  }, [store.nodes, store.name, id])

  const handleSaveDraft = async () => {
    if (savingRef.current) return
    const trimmedName = store.name?.trim() || ''

    if (!trimmedName) {
      toast({ variant: 'destructive', title: 'Validation error', description: 'Please enter a workflow name' })
      return
    }

    if (store.nodes.filter(n => n.type === 'step').length === 0) {
      toast({ variant: 'destructive', title: 'Validation error', description: 'Please add at least one step before saving' })
      return
    }

    savingRef.current = true
    setSaving(true)
    try {
      const config = buildWorkflowConfig()
      if (!isNew && id) {
        await updateWorkflow.mutateAsync({ id, data: { name: trimmedName, config } })
      } else {
        await createWorkflow.mutateAsync({ type: 'custom', name: trimmedName, config })
      }
      toast({ title: 'Saved', description: `${trimmedName} saved successfully` })
      navigate('/workflows')
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err instanceof Error ? err.message : 'Failed to save workflow' })
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleSimulate = () => {
    if (!simUserId) return
    setSimResult({
      userId: simUserId,
      workflowId: id || 'new',
      timeline: store.nodes.filter(n => n.type === 'step').map((n, i) => ({
        timestamp: new Date(Date.now() + i * 60000).toISOString(),
        type: n.step?.action?.type || 'unknown',
        description: `Simulated step ${i + 1}`,
        step_id: n.id,
      }))
    })
    toast({ title: 'Simulation completed' })
  }

  const selectedNode = store.nodes.find((n) => n.id === store.selectedNodeId) || null

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Toolbar */}
      <header className="flex items-center justify-between px-4 h-14 border-b shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/workflows">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">Custom Workflow</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={store.name}
            onChange={(e) => store.setName(e.target.value)}
            className="text-lg font-semibold border-none bg-transparent w-64 focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setSimResult(null); setSimOpen(true) }}>
            <Play className="h-3.5 w-3.5 mr-1.5" />
            Simulate
          </Button>
          <Button size="sm" onClick={handleSaveDraft} disabled={saving}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saving ? 'Saving...' : id ? 'Update Workflow' : 'Save Draft'}
          </Button>
        </div>
      </header>

      {/* 3-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Palette */}
        <aside className="w-56 border-r p-3 space-y-5 overflow-y-auto shrink-0">
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
              Actions
            </h3>
            <div className="space-y-1">
              <PaletteItem
                icon={MessageCircle}
                label="Send WhatsApp"
                color="bg-green-500"
                onClick={() => addStepWithAction('send_whatsapp')}
              />
              <PaletteItem
                icon={Mail}
                label="Send Email"
                color="bg-blue-500"
                onClick={() => addStepWithAction('send_email')}
              />
              <PaletteItem
                icon={Smartphone}
                label="Send SMS"
                color="bg-emerald-500"
                onClick={() => addStepWithAction('send_sms')}
              />
              <PaletteItem
                icon={Bell}
                label="Send Push"
                color="bg-amber-500"
                onClick={() => addStepWithAction('send_push')}
              />
              <PaletteItem
                icon={MessageSquare}
                label="Slack Alert"
                color="bg-purple-500"
                onClick={() => addStepWithAction('send_slack_alert')}
              />
              <PaletteItem
                icon={Webhook}
                label="Trigger Webhook"
                color="bg-orange-500"
                onClick={() => addStepWithAction('trigger_webhook')}
              />
              <PaletteItem
                icon={Timer}
                label="Wait for Event"
                color="bg-yellow-500"
                onClick={() => addStepWithAction('wait_for_event')}
              />
              <PaletteItem
                icon={Tag}
                label="Update User"
                color="bg-cyan-500"
                onClick={() => addStepWithAction('update_user')}
              />
              <PaletteItem
                icon={SplitSquareHorizontal}
                label="A/B Split"
                color="bg-pink-500"
                onClick={() => addStepWithAction('ab_split')}
              />
              <PaletteItem
                icon={ThumbsUp}
                label="Send Recommendations"
                color="bg-teal-500"
                onClick={() => addStepWithAction('send_recommendations')}
              />
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
              Logic
            </h3>
            <div className="space-y-1">
              <PaletteItem
                icon={Filter}
                label="Condition"
                color="bg-slate-500"
                onClick={addConditionNode}
              />
              <PaletteItem
                icon={X}
                label="Exit"
                color="bg-rose-500"
                onClick={addExitNode}
              />
            </div>
          </section>
        </aside>

        {/* Center — Canvas */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-lg mx-auto">
            <div className="relative space-y-2">
              {store.nodes.map((node, index) => (
                <div key={node.id}>
                  {index > 0 && (
                    <div className="flex justify-center py-1">
                      <div className="w-px h-4 bg-border" />
                    </div>
                  )}
                  <CanvasNode
                    node={node}
                    isSelected={store.selectedNodeId === node.id}
                    onSelect={() => store.selectNode(node.id)}
                    onDelete={() => store.removeNode(node.id)}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-center mt-4">
              <Button variant="ghost" size="sm" onClick={addStepNode}>
                <Plus className="h-4 w-4 mr-1" />
                Add Step
              </Button>
            </div>
          </div>
        </main>

        {/* Right — Config Panel */}
        <aside className="w-72 border-l overflow-y-auto p-4 shrink-0">
          {selectedNode ? (
            <ConfigPanel node={selectedNode} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground text-center">
                Select a node to configure
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* Simulation Modal */}
      <SimulationModal
        open={simOpen}
        onOpenChange={(open) => { setSimOpen(open); if (!open) setSimResult(null) }}
        onRun={handleSimulate}
        result={simResult}
        userId={simUserId}
        onUserIdChange={setSimUserId}
        loading={false}
      />
    </div>
  )
}
