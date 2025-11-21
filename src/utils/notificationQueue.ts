
import { PrismaClient } from '@prisma/client';
import logger from './logger';

const prisma = new PrismaClient();

interface FailedNotification {
  id: string;
  channelId: string;
  message: string;
  retryCount: number;
  nextAttemptAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationQueue {
  private static instance: NotificationQueue;
  private retryIntervalsMs = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000, 60 * 60 * 1000]; // 1m, 5m, 15m, 30m, 1h
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;

  private constructor() {}

  public static getInstance(): NotificationQueue {
    if (!NotificationQueue.instance) {
      NotificationQueue.instance = new NotificationQueue();
    }
    return NotificationQueue.instance;
  }

  public async addFailedNotification(channelId: string, message: string): Promise<void> {
    try {
      await prisma.failedNotification.create({
        data: {
          channelId,
          message,
          retryCount: 0,
          nextAttemptAt: new Date(Date.now() + this.retryIntervalsMs[0]),
        },
      });
      logger.info(`Added failed notification to queue for channel ${channelId}`);
    } catch (error) {
      logger.error(`Failed to add notification to queue: ${error}`);
    }
  }

  public startProcessing(): void {
    if (this.processingInterval) {
      logger.warn('Notification queue processing already started.');
      return;
    }

    this.processingInterval = setInterval(async () => {
      if (this.isProcessing) {
        logger.debug('Notification queue already processing, skipping this interval.');
        return;
      }
      try {
        await this.processQueue();
      } catch (error) {
        logger.error(`Error during notification queue processing: ${error}`);
      }
    }, 30 * 1000); // Check every 30 seconds
    logger.info('Notification queue processing started.');
  }

  public stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('Notification queue processing stopped.');
    }
  }

  private async processQueue(): Promise<void> {
    this.isProcessing = true;
    try {
      const now = new Date();
      const notificationsToRetry = await prisma.failedNotification.findMany({
        where: {
          nextAttemptAt: { lte: now },
          retryCount: { lt: this.retryIntervalsMs.length },
        },
        orderBy: {
          nextAttemptAt: 'asc',
        },
      });

      for (const notification of notificationsToRetry) {
        try {
          await this.retryNotification(notification);
        } catch (error) {
          logger.error(`Error retrying notification ${notification.id}: ${error}`);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async retryNotification(notification: FailedNotification): Promise<void> {
    logger.info(`Retrying notification ${notification.id} for channel ${notification.channelId}`);
    // TODO: Implement actual Discord notification sending logic here
    const success = Math.random() > 0.5; // Simulate success/failure

    if (success) {
      await prisma.failedNotification.delete({
        where: { id: notification.id },
      });
      logger.info(`Successfully sent notification ${notification.id} to channel ${notification.channelId}`);
    } else {
      const newRetryCount = notification.retryCount + 1;
      const nextAttemptAt = new Date(Date.now() + this.retryIntervalsMs[newRetryCount] || this.retryIntervalsMs[this.retryIntervalsMs.length - 1]);

      if (newRetryCount >= this.retryIntervalsMs.length) {
        logger.error(`Notification ${notification.id} for channel ${notification.channelId} exhausted all retries.`);
        // Optionally, move to a dead-letter queue or log for manual intervention
        await prisma.failedNotification.delete({
          where: { id: notification.id },
        });
      } else {
        await prisma.failedNotification.update({
          where: { id: notification.id },
          data: {
            retryCount: newRetryCount,
            nextAttemptAt,
          },
        });
        logger.warn(`Failed to send notification ${notification.id} to channel ${notification.channelId}. Retrying in ${this.retryIntervalsMs[newRetryCount] / 1000} seconds.`);
      }
    }
  }
}
