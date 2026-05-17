import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class InactivityDetector {
  /**
   * Run the inactivity detection job.
   * Finds users based on last_seen_at and updates their states.
   * Idempotent operation.
   */
  async run(): Promise<void> {
    console.log(`[InactivityDetector] Starting check at ${new Date().toISOString()}`);

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // active -> at_risk (3-5 days inactive)
    const atRiskUsers = await prisma.user.updateMany({
      where: {
        state: 'active',
        last_seen_at: {
          lte: threeDaysAgo,
          gt: fiveDaysAgo
        }
      },
      data: {
        state: 'at_risk'
      }
    });

    if (atRiskUsers.count > 0) {
      console.log(`[InactivityDetector] Marked ${atRiskUsers.count} users as at_risk`);
      // Here we would emit state change events to trigger relevant workflows
    }

    // at_risk -> cold (5-14 days inactive)
    const coldUsers = await prisma.user.updateMany({
      where: {
        state: { in: ['active', 'at_risk'] },
        last_seen_at: {
          lte: fiveDaysAgo,
          gt: fourteenDaysAgo
        }
      },
      data: {
        state: 'cold'
      }
    });

    if (coldUsers.count > 0) {
      console.log(`[InactivityDetector] Marked ${coldUsers.count} users as cold`);
      // Emit state change events
    }

    // cold -> churned (14+ days inactive)
    const churnedUsers = await prisma.user.updateMany({
      where: {
        state: { not: 'churned' },
        last_seen_at: {
          lte: fourteenDaysAgo
        }
      },
      data: {
        state: 'churned'
      }
    });

    if (churnedUsers.count > 0) {
      console.log(`[InactivityDetector] Marked ${churnedUsers.count} users as churned`);
      // Emit state change events
    }

    console.log(`[InactivityDetector] Check completed.`);
  }
}
