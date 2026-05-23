export type UserState = 'active' | 'at_risk' | 'cold' | 'churned';

export interface User {
  id: string;
  workspace_id: string;
  name?: string;
  email?: string;
  last_seen_at: string;
  state: UserState;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TrackedEvent {
  id: string;
  user_id: string;
  workspace_id: string;
  event_name: string;
  properties?: Record<string, unknown>;
  occurred_at: string;
}

export type WorkflowStatus = 'active' | 'paused' | 'draft';

export interface Workflow {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  config: WorkflowConfig;
  active: boolean;
  created_at: string;
  updated_at: string;
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

export interface WorkflowTrigger {
  type: string;
  config?: Record<string, unknown>;
  triggers?: WorkflowTrigger[];
}

export interface WorkflowCondition {
  field: string;
  operator: string;
  value: unknown;
  if_true?: string;
  if_false?: string;
}

export interface WorkflowStep {
  id: string;
  delay: { value: number; unit: 'minutes' | 'hours' | 'days' };
  action: WorkflowAction;
  condition?: StepCondition;
}

export interface WorkflowAction {
  type: string;
  config: Record<string, unknown>;
}

export interface StepCondition {
  type: string;
  config: Record<string, unknown>;
}

export interface ExitCondition {
  type: string;
  config: Record<string, unknown>;
}

export interface Enrollment {
  id: string;
  user_id: string;
  workflow_id: string;
  current_step?: string;
  status: 'active' | 'paused' | 'completed' | 'exited';
  enrolled_at: string;
}

export interface WorkflowLog {
  id: string;
  enrollment_id: string;
  step_id: string;
  action_type: string;
  result?: Record<string, unknown>;
  executed_at: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  config: WorkflowConfig;
  category: string;
  tags: string[];
  channels?: string[];
  rate?: string;
  is_public: boolean;
  author_workspace_id: string;
  created_at: string;
  updated_at: string;
}

export interface SimulationResult {
  userId: string;
  workflowId: string;
  timeline: SimulatedEvent[];
}

export interface SimulatedEvent {
  timestamp: string;
  type: string;
  description: string;
  step_id?: string;
  details?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: { field: string; message: string }[];
  warnings: { field: string; message: string }[];
}
