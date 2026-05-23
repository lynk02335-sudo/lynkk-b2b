import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { WorkflowConfig, WorkflowStep } from '../types/workflow';

const prisma = new PrismaClient();

export class WorkflowExecutor {
  constructor(private workflowQueue: Queue) {}

  /**
   * Enroll a user into a workflow.
   */
  async enroll(userId: string, workflowConfig: WorkflowConfig): Promise<void> {
    // 1. Check if user is already enrolled and active
    const existing = await prisma.enrollment.findFirst({
      where: {
        user_id: userId,
        workflow_id: workflowConfig.id,
        status: 'active'
      }
    });

    if (existing) {
      console.log(`User ${userId} is already enrolled in workflow ${workflowConfig.id}`);
      return;
    }

    // 2. Create the enrollment record
    const enrollment = await prisma.enrollment.create({
      data: {
        user_id: userId,
        workflow_id: workflowConfig.id,
        status: 'active'
      }
    });

    // 3. Queue the first step if steps exist
    if (workflowConfig.steps.length > 0) {
      const firstStep = workflowConfig.steps[0];
      await this.queueStep(enrollment.id, workflowConfig, firstStep);
    } else {
      await this.exit(userId, workflowConfig.id, 'No steps in workflow');
    }
  }

  /**
   * Execute a step and advance to the next.
   */
  async advance(enrollmentId: string, workflowConfig: WorkflowConfig, stepId: string): Promise<void> {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { user: true }
    });

    if (!enrollment || enrollment.status !== 'active') {
      console.log(`Enrollment ${enrollmentId} is not active. Skipping.`);
      return;
    }

    // Check exit conditions
    if (await this.checkExitConditions(enrollment.user, workflowConfig)) {
      await this.exit(enrollment.user_id, workflowConfig.id, 'Exit condition met');
      return;
    }

    const currentStepIndex = workflowConfig.steps.findIndex(s => s.id === stepId);
    if (currentStepIndex === -1) return;

    const currentStep = workflowConfig.steps[currentStepIndex];

    // Execute the action (simplified for stubbing)
    console.log(`[WorkflowExecutor] Executing step ${currentStep.id} action ${currentStep.action.type} for enrollment ${enrollment.id}`);
    
    // Log the execution
    await prisma.workflowLog.create({
      data: {
        enrollment_id: enrollment.id,
        step_id: currentStep.id,
        action_type: currentStep.action.type,
        result: { status: 'success' }
      }
    });

    // Queue the next step
    if (currentStepIndex + 1 < workflowConfig.steps.length) {
      const nextStep = workflowConfig.steps[currentStepIndex + 1];
      await this.queueStep(enrollment.id, workflowConfig, nextStep);
    } else {
      // Completed workflow
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: 'completed' }
      });
    }
  }

  /**
   * Exit/Pause an enrollment.
   */
  async exit(userId: string, workflowId: string, reason: string): Promise<void> {
    console.log(`[WorkflowExecutor] Exiting user ${userId} from workflow ${workflowId}. Reason: ${reason}`);
    
    await prisma.enrollment.updateMany({
      where: {
        user_id: userId,
        workflow_id: workflowId,
        status: 'active'
      },
      data: {
        status: 'exited'
      }
    });
  }

  /**
   * Get active enrollments for a user.
   */
  async getActiveEnrollments(userId: string) {
    return prisma.enrollment.findMany({
      where: {
        user_id: userId,
        status: 'active'
      }
    });
  }

  private async queueStep(enrollmentId: string, workflow: WorkflowConfig, step: WorkflowStep) {
    let delayMs = 0;
    if (step.delay) {
      const { value, unit } = step.delay;
      if (unit === 'minutes') delayMs = value * 60 * 1000;
      else if (unit === 'hours') delayMs = value * 60 * 60 * 1000;
      else if (unit === 'days') delayMs = value * 24 * 60 * 60 * 1000;
    }

    console.log(`[WorkflowExecutor] Queueing step ${step.id} for enrollment ${enrollmentId} in ${delayMs}ms`);

    await this.workflowQueue.add('execute-step', {
      enrollmentId,
      workflowConfig: workflow,
      stepId: step.id
    }, {
      delay: delayMs
    });
  }

  private async checkExitConditions(user: any, workflow: WorkflowConfig): Promise<boolean> {
    if (!workflow.exit_conditions || workflow.exit_conditions.length === 0) return false;

    // For now, simple state check
    for (const condition of workflow.exit_conditions) {
      if (condition.type === 'state_changed' && condition.config.state === user.state) {
        return true;
      }
    }
    return false;
  }
}
