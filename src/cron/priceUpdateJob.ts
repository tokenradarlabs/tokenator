import cron from 'node-cron';
import logger from '../utils/logger';
import { Client, ActivityType, TextChannel } from 'discord.js';
import prisma from '../utils/prisma';
import { getDevPrice, getBtcPrice, getEthPrice } from '../utils/uniswapPrice';
import { STANDARD_TOKEN_IDS } from '../utils/constants';
import { ALERT_COOLDOWN_PERIOD_MS } from '../utils/alertUtils';
import { formatPriceForDisplay, formatPriceForAlert } from '../utils/priceFormatter';

// In-memory store for the latest fetched data
let latestDevPrice: number | null = null;

/**
 * Cleans up orphaned alerts for deleted Discord channels
 * @param client The Discord Client instance
 */
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
          // Channel doesn't exist, delete the alert
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
        // If we get an error fetching the channel (e.g., Unknown Channel), delete the alert
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

/**
 * Transaction-aware version of checkPriceAlerts that works within a database transaction.
 * This ensures alert checking happens atomically with price updates.
 * @param tx The Prisma transaction context
 * @param client The Discord Client instance
 * @param tokenId The token identifier
 * @param currentPrice The current price of the token
 * @param previousPrice The previous price from before the update
 */
async function checkPriceAlertsWithTransaction(
  tx: any,
  client: Client,
  tokenId: string,
  currentPrice: number,
  previousPrice: any
) {
  try {
    // First get the token record within the transaction
    const token = await tx.token.findUnique({
      where: { address: tokenId },
    });

    if (!token) {
      logger.warn(`[CronJob-PriceAlert] No token found for ID: ${tokenId}`);
      return;
    }

    // Log the price change
    if (previousPrice) {
      logger.info(
        `[CronJob-PriceAlert] Price change for ${tokenId}: ${formatPriceForDisplay(previousPrice.price)} -> ${formatPriceForDisplay(currentPrice)}`
      );
    }

    // Cooldown period to prevent rapid re-triggering
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
        // Only include alerts that haven't been triggered recently or haven't been triggered at all
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

      // If we have a previous price, check if the price crossed the threshold
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
        // Fallback to simple threshold check if no previous price
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
          // Atomic operation: Update lastTriggered and disable alert within the transaction
          const updatedAlert = await tx.alert.updateMany({
            where: {
              id: alert.id,
              enabled: true,
              // Double-check cooldown to prevent race conditions
              OR: [
                { lastTriggered: null },
                { lastTriggered: { lt: cooldownThreshold } },
              ],
            },
            data: {
              enabled: false,
              lastTriggered: now,
            },
          });

          // Only send notification if we successfully updated the alert
          if (updatedAlert.count > 0) {
            // Send Discord notification (this happens outside the transaction but after the alert is marked as triggered)
            // We'll queue this for after the transaction commits
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
                      `This alert has been automatically disabled.`
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
            // Another process already triggered this alert
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
          // Re-throw to ensure transaction rolls back
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
    // Re-throw to ensure transaction rolls back
    throw error;
  }
}

/**
 * Updates market metrics and checks all token alerts
 */
async function updateMarketMetrics(client: Client) {
  try {
    // Update DEV price from Uniswap
    try {
      const devPrice = await getDevPrice();
      latestDevPrice = devPrice;
      
      // Get the previous price before updating
      const previousPrice = await prisma.tokenPrice.findFirst({
        where: {
          token: { address: STANDARD_TOKEN_IDS.DEV },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      // Wrap price update and alert checking in a single transaction
      await prisma.$transaction(async (tx) => {
        // Update token price within transaction
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

        // Check price alerts within the same transaction, passing the previous price
        await checkPriceAlertsWithTransaction(tx, client, STANDARD_TOKEN_IDS.DEV, devPrice, previousPrice);
      });
      
      logger.info(`[CronJob-MarketMetrics] Updated DEV price: $${devPrice}`);
    } catch (error) {
      logger.error(`[CronJob-MarketMetrics] Error updating DEV price:`, error);
    }

    // Update BTC price from Uniswap
    try {
      const btcPrice = await getBtcPrice();
      
      // Get the previous price before updating
      const previousPrice = await prisma.tokenPrice.findFirst({
        where: {
          token: { address: STANDARD_TOKEN_IDS.BTC },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });
      
      // Wrap price update and alert checking in a single transaction
      await prisma.$transaction(async (tx) => {
        // Update token price within transaction
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

        // Check price alerts within the same transaction, passing the previous price
        await checkPriceAlertsWithTransaction(tx, client, STANDARD_TOKEN_IDS.BTC, btcPrice, previousPrice);
      });
      
      logger.info(`[CronJob-MarketMetrics] Updated BTC price: $${btcPrice}`);
    } catch (error) {
      logger.error(`[CronJob-MarketMetrics] Error updating BTC price:`, error);
    }

    // Update ETH price from Uniswap
    try {
      const ethPrice = await getEthPrice();
      
      // Get the previous price before updating
      const previousPrice = await prisma.tokenPrice.findFirst({
        where: {
          token: { address: STANDARD_TOKEN_IDS.ETH },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });
      
      // Wrap price update and alert checking in a single transaction
      await prisma.$transaction(async (tx) => {
        // Update token price within transaction
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

        // Check price alerts within the same transaction, passing the previous price
        await checkPriceAlertsWithTransaction(tx, client, STANDARD_TOKEN_IDS.ETH, ethPrice, previousPrice);
      });
      
      logger.info(`[CronJob-MarketMetrics] Updated ETH price: $${ethPrice}`);
    } catch (error) {
      logger.error(`[CronJob-MarketMetrics] Error updating ETH price:`, error);
    }

    // Update bot status with latest price
    if (latestDevPrice !== null) {
      client.user?.setActivity(`DEV: ${formatPriceForDisplay(latestDevPrice)}`, {
        type: ActivityType.Watching,
      });
    }
  } catch (error) {
    logger.error(
      `[CronJob-MarketMetrics] Error updating market metrics:`,
      error
    );
  }
}

/**
 * Starts the price update cron job
 */
export function startDevPriceUpdateJob(client: Client) {
  // Run initial cleanup and market metrics update on startup
  Promise.all([
    cleanupOrphanedAlerts(client),
    updateMarketMetrics(client),
  ]).catch(error => {
    logger.error(`[CronJob] Error running initial startup tasks:`, error);
  });

  // Run market metrics update every minute
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

  // Run cleanup of orphaned alerts every hour
  try {
    cron.schedule(
      '0 * * * *', // At minute 0 of every hour
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
}
