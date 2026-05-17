import { WorkflowConfig } from '../types/workflow';

export const trial_recovery: WorkflowConfig = {
  id: 'trial_recovery',
  name: 'Trial Recovery',
  description: 'Day 0, 2, 4 of trial inactive -> WhatsApp nudge + Email',
  trigger: {
    type: 'user.inactive_3d'
  },
  steps: [
    {
      id: 'step_1',
      delay: { value: 0, unit: 'minutes' },
      action: {
        type: 'send_whatsapp',
        config: { template: 'trial_nudge_1' }
      }
    },
    {
      id: 'step_2',
      delay: { value: 2, unit: 'days' },
      action: {
        type: 'send_email',
        config: { template: 'trial_nudge_2' }
      }
    },
    {
      id: 'step_3',
      delay: { value: 2, unit: 'days' },
      action: {
        type: 'send_whatsapp',
        config: { template: 'trial_nudge_3' }
      }
    }
  ],
  exit_conditions: [
    {
      type: 'state_changed',
      config: { state: 'active' }
    }
  ]
};

export const pricing_page_recovery: WorkflowConfig = {
  id: 'pricing_page_recovery',
  name: 'Pricing Page Recovery',
  description: 'User visited pricing but didn\'t convert',
  trigger: {
    type: 'event.occurred',
    config: { event_name: 'viewed_pricing' }
  },
  steps: [
    {
      id: 'step_1',
      delay: { value: 1, unit: 'hours' },
      action: {
        type: 'send_email',
        config: { template: 'pricing_offer' }
      }
    }
  ],
  exit_conditions: [
    {
      type: 'event_occurred',
      config: { event_name: 'upgraded_plan' }
    }
  ]
};

export const setup_completion: WorkflowConfig = {
  id: 'setup_completion',
  name: 'Setup Completion',
  description: 'User signed up but never completed onboarding event',
  trigger: {
    type: 'event.not_occurred',
    config: { event_name: 'completed_onboarding', timeframe: '24h' }
  },
  steps: [
    {
      id: 'step_1',
      delay: { value: 24, unit: 'hours' },
      action: {
        type: 'send_email',
        config: { template: 'setup_reminder' }
      }
    }
  ]
};

export const aha_moment_booster: WorkflowConfig = {
  id: 'aha_moment_booster',
  name: 'Aha Moment Booster',
  description: 'Push users toward their first wow moment',
  trigger: {
    type: 'event.occurred',
    config: { event_name: 'signed_up' }
  },
  steps: [
    {
      id: 'step_1',
      delay: { value: 2, unit: 'days' },
      action: {
        type: 'send_email',
        config: { template: 'aha_moment_guide' }
      }
    }
  ]
};

export const silent_churn_alert: WorkflowConfig = {
  id: 'silent_churn_alert',
  name: 'Silent Churn Alert',
  description: 'Slack alert to CS team when account goes cold',
  trigger: {
    type: 'user.inactive_14d'
  },
  steps: [
    {
      id: 'step_1',
      delay: { value: 0, unit: 'minutes' },
      action: {
        type: 'send_slack_alert',
        config: { channel: '#cs-alerts', message: 'User {{user.id}} has gone cold.' }
      }
    }
  ]
};

export const upgrade_intent: WorkflowConfig = {
  id: 'upgrade_intent',
  name: 'Upgrade Intent',
  description: 'User hit usage limit -> nurture toward paid plan',
  trigger: {
    type: 'event.occurred',
    config: { event_name: 'usage_limit_reached' }
  },
  steps: [
    {
      id: 'step_1',
      delay: { value: 1, unit: 'hours' },
      action: {
        type: 'send_email',
        config: { template: 'upgrade_offer' }
      }
    }
  ]
};

export const streak_recovery: WorkflowConfig = {
  id: 'streak_recovery',
  name: 'Streak Recovery',
  description: 'User broke a streak -> WhatsApp reactivation',
  trigger: {
    type: 'event.occurred',
    config: { event_name: 'streak_broken' }
  },
  steps: [
    {
      id: 'step_1',
      delay: { value: 1, unit: 'hours' },
      action: {
        type: 'send_whatsapp',
        config: { template: 'streak_recovery' }
      }
    }
  ]
};

export const referral_engine: WorkflowConfig = {
  id: 'referral_engine',
  name: 'Referral Engine',
  description: 'User is highly active -> trigger referral ask + UPI reward link',
  trigger: {
    type: 'user.milestone_reached',
    config: { milestone: 'power_user' }
  },
  steps: [
    {
      id: 'step_1',
      delay: { value: 0, unit: 'minutes' },
      action: {
        type: 'send_whatsapp',
        config: { template: 'referral_ask' }
      }
    }
  ]
};

export class WorkflowLibrary {
  static templates: Record<string, WorkflowConfig> = {
    trial_recovery,
    pricing_page_recovery,
    setup_completion,
    aha_moment_booster,
    silent_churn_alert,
    upgrade_intent,
    streak_recovery,
    referral_engine
  };

  static load(id: string): WorkflowConfig {
    const template = this.templates[id];
    if (!template) {
      throw new Error(`Template ${id} not found`);
    }
    return template;
  }
}
