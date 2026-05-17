import { WorkflowConfig } from '../types/workflow';

export interface SimulatedEvent {
  timestamp: string;
  type: string;
  description: string;
  step_id?: string;
  details?: any;
}

export interface SimulationResult {
  userId: string;
  workflowId: string;
  timeline: SimulatedEvent[];
}

export class Simulator {
  /**
   * Dry-run a workflow against a specific user data snapshot.
   */
  static async simulate(workflow: WorkflowConfig, userData: any): Promise<SimulationResult> {
    const timeline: SimulatedEvent[] = [];
    let currentTime = new Date();

    timeline.push({
      timestamp: currentTime.toISOString(),
      type: 'ENROLLMENT',
      description: `User ${userData.id} evaluated for enrollment.`
    });

    // Simulate Trigger Evaluation (assuming true for simulation purposes)
    timeline.push({
      timestamp: currentTime.toISOString(),
      type: 'TRIGGER_EVALUATED',
      description: `Trigger ${workflow.trigger.type} evaluated as TRUE.`
    });

    // Simulate Execution of Steps
    for (const step of workflow.steps) {
      // Advance time by delay
      let delayMs = 0;
      if (step.delay.unit === 'minutes') delayMs = step.delay.value * 60 * 1000;
      else if (step.delay.unit === 'hours') delayMs = step.delay.value * 60 * 60 * 1000;
      else if (step.delay.unit === 'days') delayMs = step.delay.value * 24 * 60 * 60 * 1000;

      currentTime = new Date(currentTime.getTime() + delayMs);

      // Check Exit Conditions
      if (workflow.exit_conditions && workflow.exit_conditions.length > 0) {
        // In a real simulation, we'd check against projected user state
        timeline.push({
          timestamp: currentTime.toISOString(),
          type: 'CONDITION_CHECK',
          description: `Checked exit conditions prior to step ${step.id}. (Assumed FALSE for simulation).`
        });
      }

      timeline.push({
        timestamp: currentTime.toISOString(),
        type: 'ACTION_EXECUTED',
        step_id: step.id,
        description: `Simulated action ${step.action.type}`,
        details: step.action.config
      });
    }

    timeline.push({
      timestamp: currentTime.toISOString(),
      type: 'WORKFLOW_COMPLETED',
      description: `User ${userData.id} reached the end of the workflow.`
    });

    return {
      userId: userData.id,
      workflowId: workflow.id,
      timeline
    };
  }
}
