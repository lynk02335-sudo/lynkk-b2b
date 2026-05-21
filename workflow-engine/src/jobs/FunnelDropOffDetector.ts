import { createClient } from '@supabase/supabase-js';
import { TriggerEngine } from '../core/TriggerEngine';
import { WorkflowTrigger } from '../types/workflow';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export class FunnelDropOffDetector {
  private triggerEngine = new TriggerEngine();

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
        .select('email')
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
          await supabase.from('events').insert({
            customer_id: workflow.customer_id,
            tracked_user_email: user.email,
            event_name: 'workflow.triggered',
            properties: {
              workflow_id: workflow.id,
              trigger_type: 'funnel.drop_off',
              funnel_id: triggerConfig.funnel_id,
              step_index: triggerConfig.step_index,
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
}
