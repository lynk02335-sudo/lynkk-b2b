import { WorkflowTrigger } from '../types/workflow';

export class TriggerEngine {
  /**
   * Evaluates if a trigger condition is met based on user data/events
   */
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
        // Complex logic to check if event did not occur in timeframe
        // This would typically involve a DB query
        return true; 
        
      case 'user.state_changed':
        return trigger.config?.state === userData.state;

      case 'user.milestone_reached':
        return trigger.config?.milestone === eventData?.properties?.milestone;
        
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

  private isInactive(userData: any, days: number): boolean {
    if (!userData || !userData.last_seen_at) return false;
    const lastSeen = new Date(userData.last_seen_at).getTime();
    const diffDays = (Date.now() - lastSeen) / (1000 * 60 * 60 * 24);
    return diffDays >= days;
  }
}
