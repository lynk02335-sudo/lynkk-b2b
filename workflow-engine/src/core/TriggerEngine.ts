import { createClient } from '@supabase/supabase-js';
import { WorkflowTrigger } from '../types/workflow';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export class TriggerEngine {
  async evaluate(trigger: WorkflowTrigger, userData: any, eventData?: any): Promise<boolean> {
    switch (trigger.type) {
      case 'user.inactive_3d':
        return this.isInactive(userData, 3);
      case 'user.inactive_5d':
        return this.isInactive(userData, 5);
      case 'user.inactive_14d':
        return this.isInactive(userData, 14);
      
      case 'event.occurred':
        return eventData && eventData.event_name === trigger.config?.event_name;
        
      case 'event.not_occurred':
        return true; 
        
      case 'user.state_changed':
        return trigger.config?.state === userData.state;

      case 'user.milestone_reached':
        return trigger.config?.milestone === eventData?.properties?.milestone;

      case 'funnel.drop_off':
        return this.evaluateFunnelDropOff(trigger, userData);

      case 'trigger.and':
        if (!trigger.triggers || trigger.triggers.length === 0) return false;
        for (const subTrigger of trigger.triggers) {
          if (!(await this.evaluate(subTrigger, userData, eventData))) {
            return false;
          }
        }
        return true;

      case 'trigger.or':
        if (!trigger.triggers || trigger.triggers.length === 0) return false;
        for (const subTrigger of trigger.triggers) {
          if (await this.evaluate(subTrigger, userData, eventData)) {
            return true;
          }
        }
        return false;

      default:
        return false;
    }
  }

  private async evaluateFunnelDropOff(trigger: WorkflowTrigger, userData: any): Promise<boolean> {
    const config = trigger.config || {};
    const funnelId = config.funnel_id as string;
    const stepIndex = config.step_index as number;
    const waitHours = (config.wait_hours as number) || 24;

    if (!funnelId || stepIndex === undefined || !userData?.customer_id || !userData?.email) {
      return false;
    }

    const { data: funnel } = await supabase
      .from('funnels')
      .select('steps')
      .eq('id', funnelId)
      .eq('customer_id', userData.customer_id)
      .single();

    if (!funnel?.steps || stepIndex >= funnel.steps.length - 1) return false;

    const stepName = funnel.steps[stepIndex] as string;
    const nextStepName = funnel.steps[stepIndex + 1] as string;

    const { data: stepEvents } = await supabase
      .from('events')
      .select('created_at')
      .eq('event_name', stepName)
      .eq('customer_id', userData.customer_id)
      .eq('tracked_user_email', userData.email)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!stepEvents || stepEvents.length === 0) return false;

    const lastStepTime = new Date(stepEvents[0].created_at).getTime();
    const timeSinceLastStep = (Date.now() - lastStepTime) / (1000 * 60 * 60);

    if (timeSinceLastStep < waitHours) return false;

    const { data: nextEvents } = await supabase
      .from('events')
      .select('id')
      .eq('event_name', nextStepName)
      .eq('customer_id', userData.customer_id)
      .eq('tracked_user_email', userData.email)
      .gte('created_at', stepEvents[0].created_at);

    if (nextEvents && nextEvents.length > 0) return false;

    return true;
  }

  private isInactive(userData: any, days: number): boolean {
    if (!userData || !userData.last_seen_at) return false;
    const lastSeen = new Date(userData.last_seen_at).getTime();
    const diffDays = (Date.now() - lastSeen) / (1000 * 60 * 60 * 24);
    return diffDays >= days;
  }
}
