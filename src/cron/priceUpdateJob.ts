import cron from "node-cron";
import logger from "../utils/logger";
import { Client, ActivityType, TextChannel } from "discord.js";
import { fetchTokenPrice, formatNumber } from "../utils/coinGecko";
import prisma from "../utils/prisma";
import { getDevPrice } from "../utils/uniswapPrice";

// In-memory store for the latest fetched data
let latestDevPrice: number | null = null;
let latestVolume: number | null = null;
let latestPriceChange: number | null = null;

/**
 * Checks for any triggered price alerts and sends notifications.
 * @param client The Discord Client instance
 * @param tokenId The CoinGecko token ID
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
      if (alert.priceAlert) {
        const { direction, value } = alert.priceAlert;
        let triggered = false;

        if (direction === 'up' && currentPrice >= value) {
          triggered = true;
        } else if (direction === 'down' && currentPrice <= value) {
          triggered = true;
        }

        if (triggered) {
          try {
            const channel = await client.channels.fetch(alert.channelId);
            if (channel && channel.isTextBased()) {
              const directionEmoji = direction === 'up' ? '📈' : '📉';
              const message = `🔔 **Price Alert!** ${alert.token.address} token has reached your target of $${value}. Current price is $${currentPrice.toFixed(5)}. ${directionEmoji}`;
              await (channel as TextChannel).send(message);

              // Delete the alert after it has been triggered
              await prisma.$transaction([
                prisma.priceAlert.delete({ where: { id: alert.priceAlert.id } }),
                prisma.alert.delete({ where: { id: alert.id } })
              ]);
              
              logger.info(`[CronJob-PriceAlert] Triggered and deleted alert ${alert.id} for channel ${alert.channelId}`);
            }
          } catch (error) {
            logger.error(`[CronJob-PriceAlert] Failed to send alert to channel ${alert.channelId}`, { error });
            if (error instanceof Error && 'code' in error && error.code === 10003) { // Unknown Channel
              logger.info(`[CronJob-PriceAlert] Channel ${alert.channelId} not found. Deleting alert.`);
              await prisma.$transaction([
                prisma.priceAlert.delete({ where: { id: alert.priceAlert.id } }),
                prisma.alert.delete({ where: { id: alert.id } })
              ]);
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error("[CronJob-PriceAlert] Error checking price alerts", { error });
  }
}

/**
 * Updates the DEV price from Uniswap
 */
async function updateDevPrice(client: Client) {
  try {
    const price = await getDevPrice();
    if (price && client.user) {
      latestDevPrice = price;

      try {
        // Update just the price part of the status, keeping existing market metrics
        const title = `DEV $${price.toFixed(5)}`;
        const description = latestPriceChange !== null && latestVolume !== null
          ? `24h: ${latestPriceChange >= 0 ? "📈" : "📉"}${latestPriceChange.toFixed(2)}% || Vol: $${formatNumber(latestVolume)}`
          : "Loading market data...";

        client.user.setActivity(title, {
          type: ActivityType.Watching,
          state: description,
        });

        logger.info(`[CronJob-DevPrice] Price updated: $${price} (Uniswap V3)`);
      } catch (activityError) {
        logger.error("[CronJob-DevPrice] Failed to set bot activity", {
          errorMessage: activityError instanceof Error ? activityError.message : "Unknown error",
          errorStack: activityError instanceof Error ? activityError.stack : undefined,
        });
      }
    }
  } catch (error) {
    logger.error("[CronJob-DevPrice] Error updating price", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Updates market metrics and checks all token alerts
 */
async function updateMarketMetrics(client: Client) {
  try {
    // Get all unique token addresses that have active alerts
    const tokens = await prisma.token.findMany({
      where: {
        alerts: {
          some: {
            enabled: true,
            priceAlert: {
              isNot: null
            }
          }
        }
      },
      select: {
        address: true
      }
    });

    // Check price alerts for all tokens
    for (const token of tokens) {
      try {
        const tokenData = await fetchTokenPrice(token.address);
        if (tokenData) {
          await checkPriceAlerts(client, token.address, tokenData.usd);
          logger.info(`[CronJob-MarketMetrics] Checked alerts for token: ${token.address}`);
        }
      } catch (error) {
        logger.error(`[CronJob-MarketMetrics] Error checking token ${token.address}:`, error);
      }
    }

    // Update Scout Protocol specific metrics for bot status
    const scoutTokenData = await fetchTokenPrice("scout-protocol-token");
    if (scoutTokenData && client.user) {
      const volume24h = scoutTokenData.usd_24h_vol || 0;
      const change24h = scoutTokenData.usd_24h_change || 0;

      latestVolume = volume24h;
      latestPriceChange = change24h;

      try {
        // Update the full status with latest price and new market data
        const title = latestDevPrice ? `DEV $${latestDevPrice.toFixed(5)}` : "DEV Price";
        const description = `24h: ${change24h >= 0 ? "📈" : "📉"}${change24h.toFixed(2)}% || Vol: $${formatNumber(volume24h)}`;

        client.user.setActivity(title, {
          type: ActivityType.Watching,
          state: description,
        });

        logger.info(
          `[CronJob-MarketMetrics] Scout Protocol metrics updated - Volume: $${formatNumber(volume24h)}, Change: ${change24h.toFixed(2)}%`
        );
      } catch (activityError) {
        logger.error("[CronJob-MarketMetrics] Failed to set bot activity", {
          errorMessage:
            activityError instanceof Error
              ? activityError.message
              : "Unknown error",
          errorStack:
            activityError instanceof Error ? activityError.stack : undefined,
        });
      }
    } else {
      logger.warn(
        "[CronJob-MarketMetrics] Failed to fetch Scout Protocol metrics from CoinGecko"
      );
    }
  } catch (error) {
    logger.error("[CronJob-MarketMetrics] Error updating market metrics", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Initializes and starts the cron jobs for updating the bot's status
 * @param client The Discord Client instance
 */
export function startDevPriceUpdateJob(client: Client) {
  const timezone = "UTC";

  // Price update every 1 minute
  const priceUpdateCron = "* * * * *";

  // Market metrics update every 8 minutes
  const marketMetricsCron = "*/8 * * * *";

  try {
    // Schedule price updates
    if (cron.validate(priceUpdateCron)) {
      cron.schedule(
        priceUpdateCron,
        () => {
          logger.info("[CronJob] Price update triggered");
          updateDevPrice(client);
        },
        { timezone }
      );
      logger.info(
        `[CronJob] Price updates scheduled every minute (${timezone})`
      );
      // Initial price update
      updateDevPrice(client);
    }

    // Schedule market metrics updates and all token alerts
    if (cron.validate(marketMetricsCron)) {
      cron.schedule(
        marketMetricsCron,
        () => {
          logger.info("[CronJob] Market metrics and all token alerts check triggered");
          updateMarketMetrics(client);
        },
        { timezone }
      );
      logger.info(
        `[CronJob] Market metrics and all token alerts check scheduled every 8 minutes (${timezone})`
      );
      // Initial market metrics update
      updateMarketMetrics(client);
    }
  } catch (error) {
    logger.error("[CronJob] Failed to start cron jobs", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
    });
  }
}
