import cron from 'node-cron';
import logger from '../utils/logger';
import { Client, ActivityType, TextChannel } from 'discord.js';
import prisma from '../utils/prisma';
import { getDevPrice, getBtcPrice, getEthPrice } from '../utils/uniswapPrice';
import { STANDARD_TOKEN_IDS } from '../utils/constants';
import { ALERT_COOLDOWN_PERIOD_MS } from '../utils/alertUtils';

// In-memory store for the latest fetched data
let latestDevPrice: number | null = null;
let latestBtcPrice: number | null = null;
let latestEthPrice: number | null = null;

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
 * Updates the token price in the database
 * @param tokenAddress The standardized token identifier
 * @param price The current price of the token
 */
async function updateTokenPrice(tokenAddress: string, price: number) {
  try {
    // Get or create token
    const token = await prisma.token.upsert({
      where: { address: tokenAddress },
      update: {},
      create: { address: tokenAddress },
    });

    // Create price record
    await prisma.tokenPrice.create({
      data: {
        price,
        tokenId: token.id,
      },
    });

    logger.info(
      `[CronJob-TokenPrice] Stored price for ${tokenAddress}: $${price}`
    );
  } catch (error) {
    logger.error(
      `[CronJob-TokenPrice] Error storing price for ${tokenAddress}:`,
      error
    );
  }
}

/**
 * Checks for any triggered price alerts and sends notifications.
 * Includes race condition prevention via cooldown periods and atomic operations.
 * @param client The Discord Client instance
 * @param tokenId The token identifier
 * @param currentPrice The current price of the token
 */
async function checkPriceAlerts(
  client: Client,
  tokenId: string,
  currentPrice: number
) {
  try {
    // First get the token record
    const token = await prisma.token.findUnique({
      where: { address: tokenId },
    });

    if (!token) {
      logger.warn(`[CronJob-PriceAlert] No token found for ID: ${tokenId}`);
      return;
    }

    // Get the previous price from database
    const previousPrice = await prisma.tokenPrice.findFirst({
      where: {
        tokenId: token.id, // Use the token's UUID, not the address
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    // Log the price change
    if (previousPrice) {
      logger.info(
        `[CronJob-PriceAlert] Price change for ${tokenId}: $${previousPrice.price} -> $${currentPrice}`
      );
    }

    // Cooldown period to prevent rapid re-triggering
    const now = new Date();
    const cooldownThreshold = new Date(
      now.getTime() - ALERT_COOLDOWN_PERIOD_MS
    );

    const alerts = await prisma.alert.findMany({
      where: {
        enabled: true,
        tokenId: token.id, // Use the token's UUID, not the address
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
            `[CronJob-PriceAlert] Triggering UP alert: ${previousPrice.price} -> ${currentPrice} (threshold: ${value})`
          );
        } else if (
          direction === 'down' &&
          previousPrice.price > value &&
          currentPrice <= value
        ) {
          shouldTrigger = true;
          logger.info(
            `[CronJob-PriceAlert] Triggering DOWN alert: ${previousPrice.price} -> ${currentPrice} (threshold: ${value})`
          );
        }
      } else {
        // Fallback to simple threshold check if no previous price
        if (direction === 'up' && currentPrice >= value) {
          shouldTrigger = true;
          logger.info(
            `[CronJob-PriceAlert] Triggering UP alert (no previous price): ${currentPrice} >= ${value}`
          );
        } else if (direction === 'down' && currentPrice <= value) {
          shouldTrigger = true;
          logger.info(
            `[CronJob-PriceAlert] Triggering DOWN alert (no previous price): ${currentPrice} <= ${value}`
          );
        }
      }

      if (shouldTrigger) {
        try {
          // Atomic operation: Update lastTriggered and disable alert in a transaction
          // This prevents race conditions by ensuring only one execution can modify the alert
          const updatedAlert = await prisma.alert.updateMany({
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
          // updatedAlert.count will be 1 if update was successful, 0 if another process already updated it
          if (updatedAlert.count > 0) {
            const channel = (await client.channels.fetch(
              alert.channelId
            )) as TextChannel;

            if (channel) {
              const directionEmoji = direction === 'up' ? '📈' : '📉';
              const priceChangeMsg = previousPrice
                ? `(Changed from $${previousPrice.price.toFixed(
                    5
                  )} to $${currentPrice.toFixed(5)})`
                : `(Current price: $${currentPrice.toFixed(5)})`;

              await channel.send({
                content: `${directionEmoji} **Price Alert!** ${
                  alert.token.address
                } has ${
                  direction === 'up' ? 'risen above' : 'fallen below'
                } $${value} ${priceChangeMsg}`,
              });

              logger.info(
                `[CronJob-PriceAlert] Alert triggered and disabled for ${alert.token.address}`,
                {
                  alertId: alert.id,
                  direction,
                  value,
                  currentPrice,
                  previousPrice: previousPrice?.price,
                  triggeredAt: now.toISOString(),
                }
              );
            } else {
              // Channel not found - likely deleted, clean up the orphaned alert
              await prisma.alert.delete({
                where: { id: alert.id },
              });

              logger.warn(
                `[CronJob-PriceAlert] Deleted orphaned alert for non-existent channel`,
                {
                  channelId: alert.channelId,
                  alertId: alert.id,
                  tokenAddress: alert.token.address,
                }
              );
            }
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
          // Handle specific Discord API errors for deleted channels
          if (
            error instanceof Error &&
            (error.message.includes('Unknown Channel') ||
              error.message.includes('Missing Access') ||
              error.message.includes('Forbidden'))
          ) {
            // Channel was deleted or is inaccessible, clean up the orphaned alert
            await prisma.alert.delete({
              where: { id: alert.id },
            });

            logger.warn(
              `[CronJob-PriceAlert] Deleted orphaned alert for inaccessible channel`,
              {
                channelId: alert.channelId,
                alertId: alert.id,
                tokenAddress: alert.token.address,
                error: error.message,
              }
            );
          } else {
            logger.error(
              `[CronJob-PriceAlert] Error processing alert trigger`,
              error as Error,
              {
                alertId: alert.id,
                channelId: alert.channelId,
                tokenId: alert.token.address,
              }
            );
          }
        }
      }
    }
  } catch (error) {
    logger.error(
      `[CronJob-PriceAlert] Error checking price alerts`,
      error as Error,
      {
        tokenId,
        currentPrice,
      }
    );
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
      await Promise.all([
        checkPriceAlerts(client, STANDARD_TOKEN_IDS.DEV, devPrice),
        updateTokenPrice(STANDARD_TOKEN_IDS.DEV, devPrice),
      ]);
      logger.info(`[CronJob-MarketMetrics] Updated DEV price: $${devPrice}`);
    } catch (error) {
      logger.error(`[CronJob-MarketMetrics] Error updating DEV price:`, error);
    }

    // Update BTC price from Uniswap
    try {
      const btcPrice = await getBtcPrice();
      latestBtcPrice = btcPrice;
      await Promise.all([
        checkPriceAlerts(client, STANDARD_TOKEN_IDS.BTC, btcPrice),
        updateTokenPrice(STANDARD_TOKEN_IDS.BTC, btcPrice),
      ]);
      logger.info(`[CronJob-MarketMetrics] Updated BTC price: $${btcPrice}`);
    } catch (error) {
      logger.error(`[CronJob-MarketMetrics] Error updating BTC price:`, error);
    }

    // Update ETH price from Uniswap
    try {
      const ethPrice = await getEthPrice();
      latestEthPrice = ethPrice;
      await Promise.all([
        checkPriceAlerts(client, STANDARD_TOKEN_IDS.ETH, ethPrice),
        updateTokenPrice(STANDARD_TOKEN_IDS.ETH, ethPrice),
      ]);
      logger.info(`[CronJob-MarketMetrics] Updated ETH price: $${ethPrice}`);
    } catch (error) {
      logger.error(`[CronJob-MarketMetrics] Error updating ETH price:`, error);
    }

    // Update bot status with latest price
    if (latestDevPrice !== null) {
      client.user?.setActivity(`DEV: $${latestDevPrice.toFixed(5)}`, {
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
