import { Queue, Worker } from 'bullmq';
import { WorkflowExecutor } from '../core/WorkflowExecutor';
import { FunnelDropOffDetector } from './FunnelDropOffDetector';
import { RecommendationGenerator } from './RecommendationGenerator';

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

// =====================================================
// FUNNEL DROP-OFF DETECTOR
// =====================================================

export const funnelDetectorQueue = new Queue('funnel-drop-off', { connection });
const funnelDetector = new FunnelDropOffDetector();

export const funnelDetectorWorker = new Worker(
  'funnel-drop-off',
  async job => {
    if (job.name === 'check-drop-off') {
      console.log('[FunnelDetectorWorker] Running funnel drop-off check');
      await funnelDetector.run();
    }
  },
  { connection },
);

funnelDetectorWorker.on('completed', job => {
  console.log(`[FunnelDetectorWorker] Job ${job.id} completed`);
});

funnelDetectorWorker.on('failed', (job, err) => {
  console.log(`[FunnelDetectorWorker] Job ${job?.id} failed: ${err.message}`);
});

// =====================================================
// RECOMMENDATION GENERATOR
// =====================================================

export const recommendationQueue = new Queue('recommendations', { connection });
const recommendationGenerator = new RecommendationGenerator();

export const recommendationWorker = new Worker(
  'recommendations',
  async job => {
    if (job.name === 'generate-recommendations') {
      console.log('[RecommendationWorker] Generating recommendations');
      await recommendationGenerator.run();
    }
  },
  { connection },
);

recommendationWorker.on('completed', job => {
  console.log(`[RecommendationWorker] Job ${job.id} completed`);
});

recommendationWorker.on('failed', (job, err) => {
  console.log(`[RecommendationWorker] Job ${job?.id} failed: ${err.message}`);
});

export async function registerRepeatedJobs(): Promise<void> {
  const existingFunnel = await funnelDetectorQueue.getRepeatableJobs();
  const alreadyRegistered = existingFunnel.some(j => j.name === 'check-drop-off' && j.pattern === '*/15 * * * *');
  if (!alreadyRegistered) {
    await funnelDetectorQueue.add(
      'check-drop-off',
      {},
      { repeat: { pattern: '*/15 * * * *' } },
    );
    console.log('[QueueSetup] Registered funnel drop-off check (every 15 min)');
  } else {
    console.log('[QueueSetup] Funnel drop-off check already registered');
  }

  const existingRec = await recommendationQueue.getRepeatableJobs();
  const recRegistered = existingRec.some(j => j.name === 'generate-recommendations' && j.pattern === '0 2 * * *');
  if (!recRegistered) {
    await recommendationQueue.add(
      'generate-recommendations',
      {},
      { repeat: { pattern: '0 2 * * *' } },
    );
    console.log('[QueueSetup] Registered recommendation generator (daily 2am)');
  } else {
    console.log('[QueueSetup] Recommendation generator already registered');
  }
}
