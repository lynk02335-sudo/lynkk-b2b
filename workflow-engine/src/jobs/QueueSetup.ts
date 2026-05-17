import { Queue, Worker } from 'bullmq';
import { WorkflowExecutor } from '../core/WorkflowExecutor';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10)
};

export const workflowQueue = new Queue('workflow-steps', { connection });

// Initialize the executor
export const workflowExecutor = new WorkflowExecutor(workflowQueue);

// Worker to process delayed workflow steps
export const workflowWorker = new Worker('workflow-steps', async job => {
  if (job.name === 'execute-step') {
    const { enrollmentId, workflowConfig, stepId } = job.data;
    console.log(`[Worker] Processing step ${stepId} for enrollment ${enrollmentId}`);
    
    await workflowExecutor.advance(enrollmentId, workflowConfig, stepId);
  }
}, { connection });

workflowWorker.on('completed', job => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

workflowWorker.on('failed', (job, err) => {
  console.log(`[Worker] Job ${job?.id} failed with error ${err.message}`);
});
