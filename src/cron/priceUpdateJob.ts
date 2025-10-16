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
      logger.warn(`[CronJob-Retry] Attempt ${attempt}/${retries} failed for ${context}. Retrying in ${delayMs}ms...`, error as Error);
      if (attempt < retries) {
        await delay(delayMs);
        delayMs *= 2; // Exponential backoff
      } else {
        logger.error(`[CronJob-Retry] All ${retries} attempts failed for ${context}. Giving up.`, error as Error);
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
        const channel = await client.channels.fetch(alert.channelId);
        if (!channel) {
          await prisma.alert.delete({
            where: { id: alert.id },
          });
          cleanedCount++;

          logger.info(
            `[CronJob-Cleanup] Deleted orphaned alert for non-existent channel`,
            {
              channelId: alert.channelId,
              alertId: alert.id,
              tokenAddress: alert.token.address,
            }
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
            `[CronJob-Cleanup] Deleted orphaned alert for inaccessible channel`,
            {
              channelId: alert.channelId,
              alertId: alert.id,
              tokenAddress: alert.token.address,
              error: error.message,
            }
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

      if (previousPrice) {
        if (
          direction === 'up' &&
          previousPrice.price < value &&
          currentPrice >= value
        ) {
          shouldTrigger = true;
          logger.info(
            `[CronJob-PriceAlert] Triggering UP alert: ${formatPriceForDisplay(previousPrice.price)} -> ${formatPriceForDisplay(currentPrice)} (threshold: ${formatPriceForDisplay(value)})`
          );
        } else if (
          direction === 'down' &&
          previousPrice.price > value &&
          currentPrice <= value
        ) {
          shouldTrigger = true;
          logger.info(
            `[CronJob-PriceAlert] Triggering DOWN alert: ${formatPriceForDisplay(previousPrice.price)} -> ${formatPriceForDisplay(currentPrice)} (threshold: ${formatPriceForDisplay(value)})`
          );
        }
      } else {
        if (direction === 'up' && currentPrice >= value) {
          shouldTrigger = true;
          logger.info(
            `[CronJob-PriceAlert] Triggering UP alert (no previous price): ${formatPriceForDisplay(currentPrice)} >= ${formatPriceForDisplay(value)}`
          );
        } else if (direction === 'down' && currentPrice <= value) {
          shouldTrigger = true;
          logger.info(
            `[CronJob-PriceAlert] Triggering DOWN alert (no previous price): ${formatPriceForDisplay(currentPrice)} <= ${formatPriceForDisplay(value)}`
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
            `[CronJob-VolumeAlert] Error processing volume alert trigger within transaction`,
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
      `[CronJob-VolumeAlert] Error checking volume alerts within transaction`,
      error as Error,
      {
        tokenId,
        currentVolume,
      }
    );
    throw error;
  }
}

async function updateMarketMetrics(client: Client) {
  let currentDevPrice: number | null = null;

  // Update DEV price
  try {
    const devPrice = await retry(
      () => getDevPrice(),
      MAX_RETRIES,
      INITIAL_RETRY_DELAY_MS,
      `DEV price from Uniswap`
    );
    currentDevPrice = devPrice;

    const previousPrice = await prisma.tokenPrice.findFirst({
      where: {
        token: { address: STANDARD_TOKEN_IDS.DEV },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    await prisma.$transaction(async (tx) => {
      const token = await tx.token.upsert({
        where: { address: STANDARD_TOKEN_IDS.DEV },
        update: {},
        create: { address: STANDARD_TOKEN_IDS.DEV },
      });

      await tx.tokenPrice.create({
        data: {
          price: devPrice,
          tokenId: token.id,
        },
      });

      await checkPriceAlertsWithTransaction(tx, client, STANDARD_TOKEN_IDS.DEV, devPrice, previousPrice);
    });

    logger.info(`[CronJob-MarketMetrics] Updated DEV price: $${devPrice}`);
  } catch (error) {
    logger.error(`[CronJob-MarketMetrics] Failed to update DEV price after multiple retries:`, error as Error);
  }

  // Update BTC price
  try {
    const btcPrice = await retry(
      () => getBtcPrice(),
      MAX_RETRIES,
      INITIAL_RETRY_DELAY_MS,
      `BTC price from Uniswap`
    );

    const previousPrice = await prisma.tokenPrice.findFirst({
      where: {
        token: { address: STANDARD_TOKEN_IDS.BTC },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    await prisma.$transaction(async (tx) => {
      const token = await tx.token.upsert({
        where: { address: STANDARD_TOKEN_IDS.BTC },
        update: {},
        create: { address: STANDARD_TOKEN_IDS.BTC },
      });

      await tx.tokenPrice.create({
        data: {
          price: btcPrice,
          tokenId: token.id,
        },
      });

      await checkPriceAlertsWithTransaction(tx, client, STANDARD_TOKEN_IDS.BTC, btcPrice, previousPrice);
    });

    logger.info(`[CronJob-MarketMetrics] Updated BTC price: $${btcPrice}`);
  } catch (error) {
    logger.error(`[CronJob-MarketMetrics] Failed to update BTC price after multiple retries:`, error as Error);
  }

  // Update ETH price
  try {
    const ethPrice = await retry(
      () => getEthPrice(),
      MAX_RETRIES,
      INITIAL_RETRY_DELAY_MS,
      `ETH price from Uniswap`
    );

    const previousPrice = await prisma.tokenPrice.findFirst({
      where: {
        token: { address: STANDARD_TOKEN_IDS.ETH },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    await prisma.$transaction(async (tx) => {
      const token = await tx.token.upsert({
        where: { address: STANDARD_TOKEN_IDS.ETH },
        update: {},
        create: { address: STANDARD_TOKEN_IDS.ETH },
      });

      await tx.tokenPrice.create({
        data: {
          price: ethPrice,
          tokenId: token.id,
        },
      });

      await checkPriceAlertsWithTransaction(tx, client, STANDARD_TOKEN_IDS.ETH, ethPrice, previousPrice);
    });

    logger.info(`[CronJob-MarketMetrics] Updated ETH price: $${ethPrice}`);
  } catch (error) {
    logger.error(`[CronJob-MarketMetrics] Failed to update ETH price after multiple retries:`, error as Error);
  }

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

async function updateVolumeMetrics(client: Client) {
  // Update DEV volume
  try {
    const devData = await fetchCoinGeckoWithRetry(STANDARD_TOKEN_IDS.DEV, `DEV volume from CoinGecko`);
    if (devData.usd_24h_vol) {
      const devVolume = devData.usd_24h_vol;

      const previousVolume = await prisma.tokenVolume.findFirst({
        where: {
          token: { address: STANDARD_TOKEN_IDS.DEV },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      await prisma.$transaction(async (tx) => {
        const token = await tx.token.upsert({
          where: { address: STANDARD_TOKEN_IDS.DEV },
          update: {},
          create: { address: STANDARD_TOKEN_IDS.DEV },
        });

        await tx.tokenVolume.create({
          data: {
            volume: devVolume,
            tokenId: token.id,
          },
        });

        await checkVolumeAlertsWithTransaction(tx, client, STANDARD_TOKEN_IDS.DEV, devVolume, previousVolume);
      });

      logger.info(`[CronJob-VolumeMetrics] Updated DEV volume: ${formatNumber(devVolume)}`);
    } else {
      logger.warn(`[CronJob-VolumeMetrics] DEV volume data not available from CoinGecko after retries.`);
    }
  } catch (error) {
    logger.error(`[CronJob-VolumeMetrics] Failed to update DEV volume after multiple retries:`, error as Error);
  }

  // Update BTC volume
  try {
    const btcData = await fetchCoinGeckoWithRetry(STANDARD_TOKEN_IDS.BTC, `BTC volume from CoinGecko`);
    if (btcData.usd_24h_vol) {
      const btcVolume = btcData.usd_24h_vol;

      const previousVolume = await prisma.tokenVolume.findFirst({
        where: {
          token: { address: STANDARD_TOKEN_IDS.BTC },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      await prisma.$transaction(async (tx) => {
        const token = await tx.token.upsert({
          where: { address: STANDARD_TOKEN_IDS.BTC },
          update: {},
          create: { address: STANDARD_TOKEN_IDS.BTC },
        });

        await tx.tokenVolume.create({
          data: {
            volume: btcVolume,
            tokenId: token.id,
          },
        });

        await checkVolumeAlertsWithTransaction(tx, client, STANDARD_TOKEN_IDS.BTC, btcVolume, previousVolume);
      });

      logger.info(`[CronJob-VolumeMetrics] Updated BTC volume: ${formatNumber(btcVolume)}`);
    } else {
      logger.warn(`[CronJob-VolumeMetrics] BTC volume data not available from CoinGecko after retries.`);
    }
  } catch (error) {
    logger.error(`[CronJob-VolumeMetrics] Failed to update BTC volume after multiple retries:`, error as Error);
  }

  // Update ETH volume
  try {
    const ethData = await fetchCoinGeckoWithRetry(STANDARD_TOKEN_IDS.ETH, `ETH volume from CoinGecko`);
    if (ethData.usd_24h_vol) {
      const ethVolume = ethData.usd_24h_vol;

      const previousVolume = await prisma.tokenVolume.findFirst({
        where: {
          token: { address: STANDARD_TOKEN_IDS.ETH },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      await prisma.$transaction(async (tx) => {
        const token = await tx.token.upsert({
          where: { address: STANDARD_TOKEN_IDS.ETH },
          update: {},
          create: { address: STANDARD_TOKEN_IDS.ETH },
        });

        await tx.tokenVolume.create({
          data: {
            volume: ethVolume,
            tokenId: token.id,
          },
        });

        await checkVolumeAlertsWithTransaction(tx, client, STANDARD_TOKEN_IDS.ETH, ethVolume, previousVolume);
      });

      logger.info(`[CronJob-VolumeMetrics] Updated ETH volume: ${formatNumber(ethVolume)}`);
    } else {
      logger.warn(`[CronJob-VolumeMetrics] ETH volume data not available from CoinGecko after retries.`);
    }
  } catch (error) {
    logger.error(`[CronJob-VolumeMetrics] Failed to update ETH volume after multiple retries:`, error as Error);
  }
}

export function startDevPriceUpdateJob(client: Client) {
  Promise.all([
    cleanupOrphanedAlerts(client),
    updateMarketMetrics(client),
    updateVolumeMetrics(client), // Run volume update on startup
  ]).catch(error => {
    logger.error(`[CronJob] Error running initial startup tasks:`, error);
  });

  try {
    cron.schedule(
      '* * * * *',
      () => {
        updateMarketMetrics(client).catch(error => {
          logger.error(
            `[CronJob] Error running scheduled market metrics update:`,
            error
          );
        });
      },
      {
        timezone: 'UTC',
      }
    );
  } catch (error) {
    logger.error('[CronJob] Error scheduling market metrics cron job:', error);
  }

  try {
    cron.schedule(
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
  } catch (error) {
    logger.error('[CronJob] Error scheduling cleanup cron job:', error);
  }

  // Daily volume metrics update (runs at 00:00 UTC every day)
  try {
    cron.schedule(
      '0 0 * * *',
      () => {
        updateVolumeMetrics(client).catch(error => {
          logger.error(
            `[CronJob] Error running scheduled volume metrics update:`,
            error
          );
        });
      },
      {
        timezone: 'UTC',
      }
    );
  } catch (error) {
    logger.error('[CronJob] Error scheduling volume metrics cron job:', error);
  }
}
