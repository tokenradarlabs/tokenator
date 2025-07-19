import cron from "node-cron";
import logger from "../utils/logger";
import { Client, ActivityType, TextChannel } from "discord.js";
import prisma from "../utils/prisma";
import { getDevPrice, getBtcPrice, getEthPrice } from "../utils/uniswapPrice";

// In-memory store for the latest fetched data
let latestDevPrice: number | null = null;
let latestBtcPrice: number | null = null;
let latestEthPrice: number | null = null;

/**
 * Updates the token price in the database
 * @param tokenAddress The token identifier
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
    const alerts = await prisma.alert.findMany({
      where: {
        enabled: true,
        token: {
          address: tokenId
        },
        priceAlert: {
          isNot: null
        }
      },
      include: {
        priceAlert: true,
        token: true
      }
    });

    for (const alert of alerts) {
      if (!alert.priceAlert) continue;

      const { direction, value } = alert.priceAlert;
      let shouldTrigger = false;

      if (direction === 'up' && currentPrice >= value) {
        shouldTrigger = true;
      } else if (direction === 'down' && currentPrice <= value) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        try {
          const channel = await client.channels.fetch(alert.channelId) as TextChannel;
          if (channel) {
            const directionEmoji = direction === 'up' ? '📈' : '📉';
            await channel.send({
              content: `${directionEmoji} **Price Alert!** ${alert.token.address} has reached $${value} (Current price: $${currentPrice.toFixed(5)})`
            });

            // Disable the alert after triggering
            await prisma.alert.update({
              where: { id: alert.id },
              data: { enabled: false }
            });

            logger.info(`[CronJob-PriceAlert] Alert triggered for ${alert.token.address}`, {
              alertId: alert.id,
              direction,
              value,
              currentPrice
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
        checkPriceAlerts(client, "scout-protocol-token", devPrice),
        updateTokenPrice("scout-protocol-token", devPrice)
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
        checkPriceAlerts(client, "bitcoin", btcPrice),
        updateTokenPrice("bitcoin", btcPrice)
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
        checkPriceAlerts(client, "eth", ethPrice),
        updateTokenPrice("eth", ethPrice)
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
