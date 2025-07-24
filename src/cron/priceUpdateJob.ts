import cron from "node-cron";
import logger from "../utils/logger";
import { Client, ActivityType, TextChannel } from "discord.js";
import prisma from "../utils/prisma";
import { getDevPrice, getBtcPrice, getEthPrice } from "../utils/uniswapPrice";

// In-memory store for the latest fetched data
let latestDevPrice: number | null = null;
let latestBtcPrice: number | null = null;
let latestEthPrice: number | null = null;

// Standardized token IDs - must match the IDs in createPriceAlert.ts
const STANDARD_TOKEN_IDS = {
  DEV: 'scout-protocol-token',
  BTC: 'bitcoin',
  ETH: 'ethereum'
} as const;

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
      create: { address: tokenAddress }
    });

    // Create price record
    await prisma.tokenPrice.create({
      data: {
        price,
        tokenId: token.id
      }
    });

    logger.info(`[CronJob-TokenPrice] Stored price for ${tokenAddress}: $${price}`);
  } catch (error) {
    logger.error(`[CronJob-TokenPrice] Error storing price for ${tokenAddress}:`, error);
  }
}

/**
 * Checks for any triggered price alerts and sends notifications.
 * @param client The Discord Client instance
 * @param tokenId The token identifier
 * @param currentPrice The current price of the token
 */
async function checkPriceAlerts(client: Client, tokenId: string, currentPrice: number) {
  try {
    // First get the token record
    const token = await prisma.token.findUnique({
      where: { address: tokenId }
    });

    if (!token) {
      logger.warn(`[CronJob-PriceAlert] No token found for ID: ${tokenId}`);
      return;
    }

    // Get the previous price from database
    const previousPrice = await prisma.tokenPrice.findFirst({
      where: {
        tokenId: token.id // Use the token's UUID, not the address
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    // Log the price change
    if (previousPrice) {
      logger.info(`[CronJob-PriceAlert] Price change for ${tokenId}: $${previousPrice.price} -> $${currentPrice}`);
    }

    const alerts = await prisma.alert.findMany({
      where: {
        enabled: true,
        tokenId: token.id, // Use the token's UUID, not the address
        priceAlert: {
          isNot: null
        }
      },
      include: {
        priceAlert: true,
        token: true
      }
    });

    logger.info(`[CronJob-PriceAlert] Found ${alerts.length} active alerts for ${tokenId}`);

    for (const alert of alerts) {
      if (!alert.priceAlert) continue;

      const { direction, value } = alert.priceAlert;
      let shouldTrigger = false;

      // If we have a previous price, check if the price crossed the threshold
      if (previousPrice) {
        if (direction === 'up' && previousPrice.price < value && currentPrice >= value) {
          shouldTrigger = true;
          logger.info(`[CronJob-PriceAlert] Triggering UP alert: ${previousPrice.price} -> ${currentPrice} (threshold: ${value})`);
        } else if (direction === 'down' && previousPrice.price > value && currentPrice <= value) {
          shouldTrigger = true;
          logger.info(`[CronJob-PriceAlert] Triggering DOWN alert: ${previousPrice.price} -> ${currentPrice} (threshold: ${value})`);
        }
      } else {
        // Fallback to simple threshold check if no previous price
        if (direction === 'up' && currentPrice >= value) {
          shouldTrigger = true;
          logger.info(`[CronJob-PriceAlert] Triggering UP alert (no previous price): ${currentPrice} >= ${value}`);
        } else if (direction === 'down' && currentPrice <= value) {
          shouldTrigger = true;
          logger.info(`[CronJob-PriceAlert] Triggering DOWN alert (no previous price): ${currentPrice} <= ${value}`);
        }
      }

      if (shouldTrigger) {
        try {
          const channel = await client.channels.fetch(alert.channelId) as TextChannel;
          if (channel) {
            const directionEmoji = direction === 'up' ? '📈' : '📉';
            const priceChangeMsg = previousPrice 
              ? `(Changed from $${previousPrice.price.toFixed(5)} to $${currentPrice.toFixed(5)})`
              : `(Current price: $${currentPrice.toFixed(5)})`;

            await channel.send({
              content: `${directionEmoji} **Price Alert!** ${alert.token.address} has ${direction === 'up' ? 'risen above' : 'fallen below'} $${value} ${priceChangeMsg}`
            });

            // Disable the alert after triggering
            await prisma.alert.update({
              where: { id: alert.id },
              data: { enabled: false }
            });

            logger.info(`[CronJob-PriceAlert] Alert triggered and disabled for ${alert.token.address}`, {
              alertId: alert.id,
              direction,
              value,
              currentPrice,
              previousPrice: previousPrice?.price
            });
          } else {
            logger.error(`[CronJob-PriceAlert] Could not find channel`, {
              channelId: alert.channelId,
              alertId: alert.id
            });
          }
        } catch (error) {
          logger.error(`[CronJob-PriceAlert] Error sending alert notification`, error as Error, {
            alertId: alert.id,
            channelId: alert.channelId
          });
        }
      }
    }
  } catch (error) {
    logger.error(`[CronJob-PriceAlert] Error checking price alerts`, error as Error, {
      tokenId,
      currentPrice
    });
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
        updateTokenPrice(STANDARD_TOKEN_IDS.DEV, devPrice)
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
        updateTokenPrice(STANDARD_TOKEN_IDS.BTC, btcPrice)
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
        updateTokenPrice(STANDARD_TOKEN_IDS.ETH, ethPrice)
      ]);
      logger.info(`[CronJob-MarketMetrics] Updated ETH price: $${ethPrice}`);
    } catch (error) {
      logger.error(`[CronJob-MarketMetrics] Error updating ETH price:`, error);
    }

    // Update bot status with latest price
    if (latestDevPrice !== null) {
      client.user?.setActivity(`DEV: $${latestDevPrice.toFixed(5)}`, { type: ActivityType.Watching });
    }

  } catch (error) {
    logger.error(`[CronJob-MarketMetrics] Error updating market metrics:`, error);
  }
}

/**
 * Starts the price update cron job
 */
export function startDevPriceUpdateJob(client: Client) {
  // Run immediately on startup
  updateMarketMetrics(client).catch(error => {
    logger.error(`[CronJob] Error running initial market metrics update:`, error);
  });

  // Then run every minute
  cron.schedule('* * * * *', () => {
    updateMarketMetrics(client).catch(error => {
      logger.error(`[CronJob] Error running scheduled market metrics update:`, error);
    });
  });
}
