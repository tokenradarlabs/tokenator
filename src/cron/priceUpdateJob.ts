import cron from 'node-cron';
import logger from '../utils/logger';
import { Client, ActivityType, TextChannel } from 'discord.js';
import prisma from '../utils/prisma';
import { getDevPrice, getBtcPrice, getEthPrice } from '../utils/uniswapPrice';
import { fetchTokenPriceDetailed } from '../utils/coinGecko';
import { STANDARD_TOKEN_IDS } from '../utils/constants';
import { ALERT_COOLDOWN_PERIOD_MS } from '../utils/alertUtils';
import { formatPriceForDisplay } from '../utils/priceFormatter';
import { formatNumber } from '../utils/coinGecko';
import { hasCrossedThreshold } from '../utils/priceComparison';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second

/**
 * Delays execution for a specified number of milliseconds.
 */
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retries an asynchronous function with exponential backoff.
 * @param fn The asynchronous function to retry.
 * @param retries The maximum number of retries.
 * @param delayMs The initial delay in milliseconds.
 * @param context A string describing the operation for logging purposes.
 */
async function retry<T>(fn: () => Promise<T>, retries: number, delayMs: number, context: string): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      logger.warn(error as Error, `[CronJob-Retry] Attempt ${attempt}/${retries} failed for ${context}. Retrying in ${delayMs}ms...`);
      if (attempt < retries) {
        await delay(delayMs);
        delayMs *= 2; // Exponential backoff
      } else {
        logger.error(error as Error, `[CronJob-Retry] All ${retries} attempts failed for ${context}. Giving up.`);
        throw error; // Re-throw the last error after all retries are exhausted
      }
    }
  }
  // This part should ideally not be reached if the loop condition is correct and an error is always thrown on failure
  throw new Error(`[CronJob-Retry] Unexpected error: retry function finished without success or re-throwing for ${context}`);
}

let latestDevPrice: number | null = null;


async function cleanupOrphanedAlerts(client: Client) {
  try {
    logger.info('[CronJob-Cleanup] Starting cleanup of orphaned alerts');

    const allAlerts = await prisma.alert.findMany({
      where: { enabled: true },
      include: { token: true },
    });

    let cleanedCount = 0;

    for (const alert of allAlerts) {
      try {
        const channel = await retry(
          async () => client.channels.fetch(alert.channelId),
          MAX_RETRIES,
          INITIAL_RETRY_DELAY_MS,
          `Discord channel fetch for ${alert.channelId}`
        );
        if (!channel) {
          await prisma.alert.delete({
            where: { id: alert.id },
          });
          cleanedCount++;

          logger.info(
            {
              channelId: alert.channelId,
              alertId: alert.id,
              tokenAddress: alert.token.address,
            },
            `[CronJob-Cleanup] Deleted orphaned alert for non-existent channel`
          );
        }
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes('Unknown Channel') ||
            error.message.includes('Missing Access') ||
            error.message.includes('Forbidden'))
        ) {
          await prisma.alert.delete({
            where: { id: alert.id },
          });
          cleanedCount++;

          logger.info(
            {
              channelId: alert.channelId,
              alertId: alert.id,
              tokenAddress: alert.token.address,
              error: error.message,
            },
            `[CronJob-Cleanup] Deleted orphaned alert for inaccessible channel`
          );
        } else {
          logger.error(
            `[CronJob-Cleanup] Error checking channel for alert`,
            error as Error,
            {
              channelId: alert.channelId,
              alertId: alert.id,
            }
          );
        }
      }
    }

    logger.info(
      `[CronJob-Cleanup] Cleanup completed. Removed ${cleanedCount} orphaned alerts`
    );
  } catch (error) {
    logger.error(
      '[CronJob-Cleanup] Error during orphaned alert cleanup',
      error as Error
    );
  }
}

async function checkPriceAlertsWithTransaction(
  tx: any,
  client: Client,
  tokenId: string,
  currentPrice: number,
  previousPrice: any
) {
  try {
    const token = await tx.token.findUnique({
      where: { address: tokenId },
    });

    if (!token) {
      logger.warn(`[CronJob-PriceAlert] No token found for ID: ${tokenId}`);
      return;
    }

    if (previousPrice) {
      logger.info(
        `[CronJob-PriceAlert] Price change for ${tokenId}: ${formatPriceForDisplay(previousPrice.price)} -> ${formatPriceForDisplay(currentPrice)}`
      );
    }

    const now = new Date();
    const cooldownThreshold = new Date(
      now.getTime() - ALERT_COOLDOWN_PERIOD_MS
    );

    const alerts = await tx.alert.findMany({
      where: {
        enabled: true,
        tokenId: token.id,
        priceAlert: {
          isNot: null,
        },
        OR: [
          { lastTriggered: null },
          { lastTriggered: { lt: cooldownThreshold } },
        ],
      },
      include: {
        priceAlert: true,
        token: true,
      },
    });

    logger.info(
      `[CronJob-PriceAlert] Found ${alerts.length} active alerts for ${tokenId} (after cooldown filter)`
    );

    for (const alert of alerts) {
      if (!alert.priceAlert) continue;

      const { direction, value } = alert.priceAlert;
      let shouldTrigger = false;

      if (hasCrossedThreshold(currentPrice, previousPrice?.price ?? null, value, direction)) {
        try {
          const updatedAlert = await tx.alert.updateMany({
            where: {
              id: alert.id,
              enabled: true,
              OR: [
                { lastTriggered: null },
                { lastTriggered: { lt: cooldownThreshold } },
              ],
            },
            data: {
              lastTriggered: now,
            },
          });

          if (updatedAlert.count > 0) {
            setImmediate(async () => {
              try {
                const channel = await client.channels.fetch(alert.channelId);
                if (channel && channel.isTextBased()) {
                  const textChannel = channel as TextChannel;
                  const directionEmoji = direction === 'up' ? '📈' : '📉';
                  await textChannel.send(
                    `${directionEmoji} **Price Alert Triggered!**\n\n` +
                      `**Token:** ${alert.token.address}\n` +
                      `**Direction:** ${direction.toUpperCase()} ${directionEmoji}\n` +
                      `**Threshold:** ${formatPriceForDisplay(value)}\n` +
                      `**Current Price:** ${formatPriceForDisplay(currentPrice)}\n` +
                      `**Previous Price:** ${previousPrice ? formatPriceForDisplay(previousPrice.price) : 'N/A'}\n\n` +
                      `This alert will be available again after the cooldown period.`
                  );

                  logger.info(
                    `[CronJob-PriceAlert] Sent notification for triggered alert`,
                    {
                      channelId: alert.channelId,
                      alertId: alert.id,
                      tokenAddress: alert.token.address,
                    }
                  );
                }
              } catch (error) {
                logger.error(
                  `[CronJob-PriceAlert] Error sending notification after transaction`,
                  error as Error,
                  {
                    alertId: alert.id,
                    channelId: alert.channelId,
                    tokenId: alert.token.address,
                  }
                );
              }
            });

            logger.info(
              `[CronJob-PriceAlert] Alert marked for notification (queued for after transaction)`,
              {
                alertId: alert.id,
                tokenId: alert.token.address,
              }
            );
          } else {
            logger.info(
              `[CronJob-PriceAlert] Alert already triggered by another process (race condition prevented)`,
              {
                alertId: alert.id,
                tokenId: alert.token.address,
              }
            );
          }
        } catch (error) {
          logger.error(
            `[CronJob-PriceAlert] Error processing alert trigger within transaction`,
            error as Error,
            {
              alertId: alert.id,
              tokenId: alert.token.address,
            }
          );
          throw error;
        }
      }
    }
  } catch (error) {
    logger.error(
      `[CronJob-PriceAlert] Error checking price alerts within transaction`,
      error as Error,
      {
        tokenId,
        currentPrice,
      }
    );
    throw error;
  }
}

async function checkVolumeAlertsWithTransaction(
  tx: any,
  client: Client,
  tokenId: string,
  currentVolume: number,
  previousVolume: any
) {
  try {
    const token = await tx.token.findUnique({
      where: { address: tokenId },
    });

    if (!token) {
      logger.warn(`[CronJob-VolumeAlert] No token found for ID: ${tokenId}`);
      return;
    }

    if (previousVolume) {
      logger.info(
        `[CronJob-VolumeAlert] Volume change for ${tokenId}: ${formatNumber(previousVolume.volume)} -> ${formatNumber(currentVolume)}`
      );
    }

    const now = new Date();
    // Volume alerts have daily cooldown (24 hours)
    const cooldownThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const alerts = await tx.alert.findMany({
      where: {
        enabled: true,
        tokenId: token.id,
        volumeAlert: {
          isNot: null,
        },
        OR: [
          { lastTriggered: null },
          { lastTriggered: { lt: cooldownThreshold } },
        ],
      },
      include: {
        volumeAlert: true,
        token: true,
      },
    });

    logger.info(
      `[CronJob-VolumeAlert] Found ${alerts.length} active volume alerts for ${tokenId} (after cooldown filter)`
    );

    for (const alert of alerts) {
      if (!alert.volumeAlert) continue;

      const { direction, value } = alert.volumeAlert;
      let shouldTrigger = false;

      if (previousVolume) {
        if (
          direction === 'up' &&
          previousVolume.volume < value &&
          currentVolume >= value
        ) {
          shouldTrigger = true;
          logger.info(
            `[CronJob-VolumeAlert] Triggering UP volume alert: ${formatNumber(previousVolume.volume)} -> ${formatNumber(currentVolume)} (threshold: ${formatNumber(value)})`
          );
        } else if (
          direction === 'down' &&
          previousVolume.volume > value &&
          currentVolume <= value
        ) {
          shouldTrigger = true;
          logger.info(
            `[CronJob-VolumeAlert] Triggering DOWN volume alert: ${formatNumber(previousVolume.volume)} -> ${formatNumber(currentVolume)} (threshold: ${formatNumber(value)})`
          );
        }
      } else {
        if (direction === 'up' && currentVolume >= value) {
          shouldTrigger = true;
          logger.info(
            `[CronJob-VolumeAlert] Triggering UP volume alert (no previous volume): ${formatNumber(currentVolume)} >= ${formatNumber(value)}`
          );
        } else if (direction === 'down' && currentVolume <= value) {
          shouldTrigger = true;
          logger.info(
            `[CronJob-VolumeAlert] Triggering DOWN volume alert (no previous volume): ${formatNumber(currentVolume)} <= ${formatNumber(value)}`
          );
        }
      }

      if (shouldTrigger) {
        try {
          const updatedAlert = await tx.alert.updateMany({
            where: {
              id: alert.id,
              enabled: true,
              OR: [
                { lastTriggered: null },
                { lastTriggered: { lt: cooldownThreshold } },
              ],
            },
            data: {
              lastTriggered: now,
            },
          });

          if (updatedAlert.count > 0) {
            setImmediate(async () => {
              try {
                const channel = await client.channels.fetch(alert.channelId);
                if (channel && channel.isTextBased()) {
                  const textChannel = channel as TextChannel;
                  const directionEmoji = direction === 'up' ? '📈' : '📉';
                  await textChannel.send(
                    `${directionEmoji} **Volume Alert Triggered!**\n\n` +
                      `**Token:** ${alert.token.address.toUpperCase()}\n` +
                      `**Direction:** ${direction.toUpperCase()} ${directionEmoji}\n` +
                      `**Threshold:** ${formatNumber(value)}\n` +
                      `**Current 24h Volume:** ${formatNumber(currentVolume)}\n` +
                      `**Previous 24h Volume:** ${previousVolume ? formatNumber(previousVolume.volume) : 'N/A'}\n\n` +
                      `This alert will be available again after the cooldown period.`
                  );

                  logger.info(
                    `[CronJob-VolumeAlert] Sent notification for triggered volume alert`,
                    {
                      channelId: alert.channelId,
                      alertId: alert.id,
                      tokenAddress: alert.token.address,
                    }
                  );
                }
              } catch (error) {
                logger.error(
                  `[CronJob-VolumeAlert] Error sending notification after transaction`,
                  error as Error,
                  {
                    alertId: alert.id,
                    channelId: alert.channelId,
                    tokenId: alert.token.address,
                  }
                );
              }
            });

            logger.info(
              `[CronJob-VolumeAlert] Volume alert marked for notification (queued for after transaction)`,
              {
                alertId: alert.id,
                tokenId: alert.token.address,
              }
            );
          } else {
            logger.info(
              `[CronJob-VolumeAlert] Volume alert already triggered by another process (race condition prevented)`,
              {
                alertId: alert.id,
                tokenId: alert.token.address,
              }
            );
          }
        } catch (error) {
          logger.error(
            { error: error as Error, alertId: alert.id, tokenId: alert.token.address },
            `[CronJob-VolumeAlert] Error processing volume alert trigger within transaction`
          );
          throw error;
        }
      }
    }
  } catch (error) {
    logger.error(
      { error: error as Error, tokenId, currentVolume },
      `[CronJob-VolumeAlert] Error checking volume alerts within transaction`
    );
    throw error;
  }
}

async function updateMarketMetrics(client: Client) {
  let currentDevPrice: number | null = null;

  currentDevPrice = await processTokenPriceUpdate(
    client,
    STANDARD_TOKEN_IDS.DEV,
    getDevPrice,
    `DEV price from Uniswap`
  );

  await processTokenPriceUpdate(
    client,
    STANDARD_TOKEN_IDS.BTC,
    getBtcPrice,
    `BTC price from Uniswap`
  );

  await processTokenPriceUpdate(
    client,
    STANDARD_TOKEN_IDS.ETH,
    getEthPrice,
    `ETH price from Uniswap`
  );

  if (currentDevPrice !== null) {
    client.user?.setActivity(`DEV: ${formatPriceForDisplay(currentDevPrice)}`, {
      type: ActivityType.Watching,
    });
  }
}

/**
 * Helper to fetch CoinGecko data with retry logic.
 * Throws an error if the fetch is not 'ok', allowing the retry mechanism to work.
 */
async function fetchCoinGeckoWithRetry(tokenId: string, context: string) {
  return retry(
    async () => {
      const result = await fetchTokenPriceDetailed(tokenId);
      if (!result.ok) {
        // For retry to work, we need to throw an error if the result is not ok
        throw new Error(`CoinGecko fetch failed for ${tokenId}: ${result.message}`);
      }
      return result.data;
    },
    MAX_RETRIES,
    INITIAL_RETRY_DELAY_MS,
    context
  );
}

async function processTokenVolumeUpdate(
  client: Client,
  tokenId: string,
  context: string
) {
  try {
    const data = await fetchCoinGeckoWithRetry(tokenId, context);
    if (data.usd_24h_vol) {
      const volume = data.usd_24h_vol;

      const previousVolume = await prisma.tokenVolume.findFirst({
        where: {
          token: { address: tokenId },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      await prisma.$transaction(async (tx) => {
        const token = await tx.token.upsert({
          where: { address: tokenId },
          update: {},
          create: { address: tokenId },
        });

        await tx.tokenVolume.create({
          data: {
            volume: volume,
            tokenId: token.id,
          },
        });

        await checkVolumeAlertsWithTransaction(tx, client, tokenId, volume, previousVolume);
      });

      logger.info(`[CronJob-VolumeMetrics] Updated ${tokenId} volume: ${formatNumber(volume)}`);
    } else {
      logger.warn(`[CronJob-VolumeMetrics] ${tokenId} volume data not available from CoinGecko after retries.`);
    }
  } catch (error) {
    logger.error({ error: error as Error, tokenId }, `[CronJob-VolumeMetrics] Failed to update ${tokenId} volume after multiple retries:`);
  }
}

async function updateVolumeMetrics(client: Client) {
  await processTokenVolumeUpdate(
    client,
    STANDARD_TOKEN_IDS.DEV,
    `DEV volume from CoinGecko`
  );

  await processTokenVolumeUpdate(
    client,
    STANDARD_TOKEN_IDS.BTC,
    `BTC volume from CoinGecko`
  );

  await processTokenVolumeUpdate(
    client,
    STANDARD_TOKEN_IDS.ETH,
    `ETH volume from CoinGecko`
  );
}

import { ScheduledTask } from 'node-cron';

let isMarketMetricsJobRunning = false;
let isVolumeMetricsJobRunning = false;
const scheduledTasks: ScheduledTask[] = [];

export function startDevPriceUpdateJob(client: Client) {
  Promise.all([
    cleanupOrphanedAlerts(client),
    updateMarketMetrics(client),
    updateVolumeMetrics(client), // Run volume update on startup
  ]).catch(error => {
    logger.error({ error }, `[CronJob] Error running initial startup tasks:`);
  });

  try {
    const marketMetricsJob = cron.schedule(
      '* * * * *',
      async () => {
        if (isMarketMetricsJobRunning) {
          logger.info('[CronJob] Market metrics update job already running, skipping this interval.');
          return;
        }
        isMarketMetricsJobRunning = true;
        try {
          await updateMarketMetrics(client);
        } catch (error) {
          logger.error(
            { error },
            `[CronJob] Error running scheduled market metrics update:`
          );
        } finally {
          isMarketMetricsJobRunning = false;
        }
      },
      {
        timezone: 'UTC',
      }
    );
    scheduledTasks.push(marketMetricsJob);
  } catch (error) {
    logger.error('[CronJob] Error scheduling market metrics cron job:', error);
  }

  try {
    const cleanupJob = cron.schedule(
      '0 * * * *',
      () => {
        cleanupOrphanedAlerts(client).catch(error => {
          logger.error(
            `[CronJob] Error running scheduled orphaned alert cleanup:`,
            error
          );
        });
      },
      {
        timezone: 'UTC',
      }
    );
    scheduledTasks.push(cleanupJob);
  } catch (error) {
    logger.error('[CronJob] Error scheduling cleanup cron job:', error);
  }

  // Daily volume metrics update (runs at 00:00 UTC every day)
  try {
    const volumeMetricsJob = cron.schedule(
      '0 0 * * *',
      async () => {
        if (isVolumeMetricsJobRunning) {
          logger.info('[CronJob] Volume metrics update job already running, skipping this interval.');
          return;
        }
        isVolumeMetricsJobRunning = true;
        try {
          await updateVolumeMetrics(client);
        } catch (error) {
          logger.error(
            `[CronJob] Error running scheduled volume metrics update:`,
            error
          );
        } finally {
          isVolumeMetricsJobRunning = false;
        }
      },
      {
        timezone: 'UTC',
      }
    );
    scheduledTasks.push(volumeMetricsJob);
  } catch (error) {
    logger.error('[CronJob] Error scheduling volume metrics cron job:', error);
  }
}

export function stopAllCronJobs(): void {
  logger.info('[CronJob] Stopping all scheduled cron jobs...');
  scheduledTasks.forEach(task => task.stop());
  logger.info('[CronJob] All scheduled cron jobs stopped.');
}
