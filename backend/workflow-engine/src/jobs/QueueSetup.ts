import { Queue, Worker } from 'bullmq';
import { WorkflowExecutor } from '../core/WorkflowExecutor';
import { FunnelDropOffDetector } from './FunnelDropOffDetector';
import { RecommendationGenerator } from './RecommendationGenerator';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

function createRedisConnection() {
  const url = new URL(redisUrl);
  return {
    host: url.hostname || 'localhost',
    port: parseInt(url.port || '6379', 10),
    ...(url.password ? { password: url.password } : {}),
  };
}

const connection = createRedisConnection();

function onError(err: Error) {
  console.warn('[BullMQ] Redis unavailable, skipping:', err.message);
}

function makeQueue<T extends Queue>(queue: T): T {
  queue.on('error', onError);
  return queue;
}

function makeWorker(worker: Worker): Worker {
  worker.on('error', onError);
  return worker;
}

function createQueuesAndWorkers() {
  try {
    const q = makeQueue(new Queue('workflow-steps', { connection }));
    const executor = new WorkflowExecutor(q);

    const w = makeWorker(new Worker('workflow-steps', async job => {
      if (job.name === 'execute-step') {
        const { enrollmentId, workflowConfig, stepId } = job.data;
        console.log(`[Worker] Processing step ${stepId} for enrollment ${enrollmentId}`);
        await executor.advance(enrollmentId, workflowConfig, stepId);
      }
    }, { connection }));

    w.on('completed', job => {
      console.log(`[Worker] Job ${job.id} completed successfully`);
    });
    w.on('failed', (job, err) => {
      console.log(`[Worker] Job ${job?.id} failed with error ${err.message}`);
    });

    const fq = makeQueue(new Queue('funnel-drop-off', { connection }));
    const detector = new FunnelDropOffDetector(q);

    const fw = makeWorker(new Worker('funnel-drop-off', async job => {
      if (job.name === 'check-drop-off') {
        console.log('[FunnelDetectorWorker] Running funnel drop-off check');
        await detector.run();
      }
    }, { connection }));

    fw.on('completed', job => {
      console.log(`[FunnelDetectorWorker] Job ${job.id} completed`);
    });
    fw.on('failed', (job, err) => {
      console.log(`[FunnelDetectorWorker] Job ${job?.id} failed: ${err.message}`);
    });

    const rq = makeQueue(new Queue('recommendations', { connection }));
    const generator = new RecommendationGenerator();

    const rw = makeWorker(new Worker('recommendations', async job => {
      if (job.name === 'generate-recommendations') {
        console.log('[RecommendationWorker] Generating recommendations');
        await generator.run();
      }
    }, { connection }));

    rw.on('completed', job => {
      console.log(`[RecommendationWorker] Job ${job.id} completed`);
    });
    rw.on('failed', (job, err) => {
      console.log(`[RecommendationWorker] Job ${job?.id} failed: ${err.message}`);
    });

    return { workflowQueue: q, workflowExecutor: executor, workflowWorker: w, funnelDetectorQueue: fq, funnelDetectorWorker: fw, recommendationQueue: rq, recommendationWorker: rw };
  } catch (err: any) {
    console.warn('[BullMQ] Redis unavailable, running without queues:', err.message);
    return null;
  }
}

const instance = createQueuesAndWorkers();

export const workflowQueue = instance?.workflowQueue ?? null;
export const workflowExecutor = instance?.workflowExecutor ?? null;
export const workflowWorker = instance?.workflowWorker ?? null;
export const funnelDetectorQueue = instance?.funnelDetectorQueue ?? null;
export const funnelDetectorWorker = instance?.funnelDetectorWorker ?? null;
export const recommendationQueue = instance?.recommendationQueue ?? null;
export const recommendationWorker = instance?.recommendationWorker ?? null;

export async function registerRepeatedJobs(): Promise<void> {
  if (!funnelDetectorQueue || !recommendationQueue) {
    console.warn('[QueueSetup] Redis unavailable, skipping repeatable job registration');
    return;
  }

  try {
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
  } catch (err: any) {
    console.warn('[QueueSetup] Redis unavailable for funnel registration:', err.message);
  }

  try {
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
  } catch (err: any) {
    console.warn('[QueueSetup] Redis unavailable for recommendation registration:', err.message);
  }
}
