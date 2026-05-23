import { Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { TriggerEngine } from '../core/TriggerEngine';
import { WorkflowTrigger, WorkflowConfig } from '../types/workflow';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: WebSocket as any } });
const prisma = new PrismaClient();

export class FunnelDropOffDetector {
  private triggerEngine = new TriggerEngine();

  constructor(private workflowQueue: Queue) {}

  async run(): Promise<void> {
    console.log(`[FunnelDropOffDetector] Starting check at ${new Date().toISOString()}`);

    const { data: workflows, error } = await supabase
      .from('workflows')
      .select('id, customer_id, name, config, trigger_config')
      .eq('is_active', true);

    if (error) {
      console.error('[FunnelDropOffDetector] Error fetching workflows:', error);
      return;
    }

    if (!workflows || workflows.length === 0) {
      console.log('[FunnelDropOffDetector] No active workflows found');
      return;
    }

    for (const workflow of workflows) {
      const triggerConfig = (workflow.trigger_config || {}) as Record<string, any>;
      const configData = (workflow.config || {}) as Record<string, any>;
      const trigger: WorkflowTrigger =
        configData.trigger || { type: 'funnel.drop_off', config: triggerConfig };

      if (trigger.type !== 'funnel.drop_off') continue;

      console.log(`[FunnelDropOffDetector] Checking workflow "${workflow.name}" (${workflow.id})`);

      const { data: users, error: userError } = await supabase
        .from('tracked_users')
        .select('email, id')
        .eq('customer_id', workflow.customer_id);

      if (userError || !users) {
        console.error(
          `[FunnelDropOffDetector] Error fetching users for workflow ${workflow.id}:`,
          userError,
        );
        continue;
      }

      console.log(
        `[FunnelDropOffDetector] Checking ${users.length} users for workflow "${workflow.name}"`,
      );

      let triggeredCount = 0;
      for (const user of users) {
        const userData = { customer_id: workflow.customer_id, email: user.email };
        const matched = await this.triggerEngine.evaluate(trigger, userData);

        if (matched) {
          triggeredCount++;

          // Enqueue the workflow for this user
          await this.enrollUser(user, workflow, configData, triggerConfig);

          // Also log the trigger event
          await supabase.from('events').insert({
            customer_id: workflow.customer_id,
            tracked_user_email: user.email,
            event_name: 'workflow.triggered',
            properties: {
              workflow_id: workflow.id,
              trigger_type: 'funnel.drop_off',
              funnel_id: triggerConfig.funnel_id,
              dropoff_step_index: triggerConfig.dropoff_step_index,
            },
          });
        }
      }

      console.log(
        `[FunnelDropOffDetector] Workflow "${workflow.name}": ${triggeredCount} users triggered`,
      );
    }

    console.log(`[FunnelDropOffDetector] Check completed at ${new Date().toISOString()}`);
  }

  private async enrollUser(
    user: { email: string; id: string },
    workflow: any,
    configData: Record<string, any>,
    triggerConfig: Record<string, any>,
  ): Promise<void> {
    try {
      // Find or create Prisma user matching this tracked user
      let prismaUser = await prisma.user.findFirst({
        where: { email: user.email },
      });

      if (!prismaUser) {
        prismaUser = await prisma.user.create({
          data: {
            email: user.email,
            workspace_id: workflow.customer_id,
            state: 'active',
          },
        });
      }

      // Build WorkflowConfig from stored config
      const workflowConfig: WorkflowConfig = {
        id: workflow.id,
        name: workflow.name,
        trigger: configData.trigger || {
          type: 'funnel.drop_off',
          config: {
            funnel_id: triggerConfig.funnel_id,
            dropoff_step_index: triggerConfig.dropoff_step_index,
            wait_window_hours: triggerConfig.wait_window_hours,
          },
        },
        steps: configData.steps || [],
        conditions: configData.conditions,
        exit_conditions: configData.exit_conditions,
      };

      // Check if user is already enrolled
      const existing = await prisma.enrollment.findFirst({
        where: {
          user_id: prismaUser.id,
          workflow_id: workflow.id,
          status: 'active',
        },
      });

      if (existing) {
        console.log(`User ${user.email} already enrolled in workflow ${workflow.id}`);
        return;
      }

      // Create enrollment
      const enrollment = await prisma.enrollment.create({
        data: {
          user_id: prismaUser.id,
          workflow_id: workflow.id,
          status: 'active',
        },
      });

      // Queue the first step if steps exist
      if (workflowConfig.steps.length > 0) {
        const firstStep = workflowConfig.steps[0];

        let delayMs = 0;
        if (firstStep.delay) {
          const { value, unit } = firstStep.delay;
          if (unit === 'minutes') delayMs = value * 60 * 1000;
          else if (unit === 'hours') delayMs = value * 60 * 60 * 1000;
          else if (unit === 'days') delayMs = value * 24 * 60 * 60 * 1000;
        }

        await this.workflowQueue.add('execute-step', {
          enrollmentId: enrollment.id,
          workflowConfig,
          stepId: firstStep.id,
        }, { delay: delayMs });

        console.log(`[FunnelDropOffDetector] Enrolled ${user.email} in workflow ${workflow.name}`);
      }
    } catch (err) {
      console.error(`[FunnelDropOffDetector] Error enrolling user ${user.email}:`, err);
    }
  }
}
