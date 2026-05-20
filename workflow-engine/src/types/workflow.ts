export type TriggerType =
  | 'user.inactive_3d'
  | 'user.inactive_5d'
  | 'user.inactive_14d'
  | 'event.not_occurred'
  | 'event.occurred'
  | 'event.sequence_incomplete'
  | 'user.state_changed'
  | 'user.trial_expiring'
  | 'user.milestone_reached'
  | 'trigger.and'
  | 'trigger.or'
  | 'event.count_reached'
  | 'event.property_match'
  | 'user.field_changed'
  | 'user.field_match'
  | 'schedule.recurring'
  | 'funnel.drop_off';

export interface WorkflowTrigger {
  type: TriggerType;
  config?: Record<string, any>;
  triggers?: WorkflowTrigger[]; // for compound triggers (and/or)
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface DelayConfig {
  value: number;
  unit: 'minutes' | 'hours' | 'days';
}

export interface StepCondition {
  type: 'event_occurred' | 'event_not_occurred' | 'state_equals';
  config: Record<string, any>;
}

export interface ReplyHandler {
  keywords: string[];
  action: WorkflowAction;
}

export type ActionType = 
  | 'send_whatsapp'
  | 'send_email'
  | 'send_slack_alert'
  | 'add_tag'
  | 'update_user_state'
  | 'trigger_webhook'
  | 'wait_for_event'
  | 'update_user'
  | 'ab_split';

export interface WorkflowAction {
  type: ActionType;
  config: Record<string, any>;
}

export interface WorkflowStep {
  id: string;
  delay: DelayConfig;
  action: WorkflowAction;
  condition?: StepCondition;
  on_reply?: ReplyHandler;
}

export interface ExitCondition {
  type: 'event_occurred' | 'state_changed';
  config: Record<string, any>;
}

export interface WorkflowConfig {
  id: string;
  name: string;
  description?: string;
  trigger: WorkflowTrigger;
  conditions?: WorkflowCondition[];
  steps: WorkflowStep[];
  exit_conditions?: ExitCondition[];
}
