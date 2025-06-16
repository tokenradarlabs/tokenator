import cron from "node-cron";
import logger from "../utils/logger";
import { Client, ActivityType } from "discord.js";
import { fetchTokenPrice, formatNumber } from "../utils/coinGecko";
import { getDevPrice } from "../utils/uniswapPrice";

// In-memory store for the latest fetched data
let latestDevPrice: number | null = null;
let latestVolume: number | null = null;
let latestPriceChange: number | null = null;

/**
 * Updates the price from Uniswap V3
 */
async function updateDevPrice(client: Client) {
  try {
    const price = await getDevPrice();
    latestDevPrice = price || latestDevPrice; // Keep old price if new one fails

    if (price && client.user) {
      try {
        // Only update the price part of the status
        const title = `DEV $${price.toFixed(5)}`;
        const description =
          latestPriceChange !== null && latestVolume !== null
            ? `24h: ${
                latestPriceChange >= 0 ? "📈" : "📉"
              }${latestPriceChange.toFixed(2)}% || Vol: $${formatNumber(
                latestVolume
              )}`
            : "Loading market data...";

        client.user.setActivity(title, {
          type: ActivityType.Watching,
          state: description,
        });

        logger.info(`[CronJob-DevPrice] Price updated: $${price} (Uniswap V3)`);
      } catch (activityError) {
        logger.error("[CronJob-DevPrice] Failed to set bot activity", {
          errorMessage:
            activityError instanceof Error
              ? activityError.message
              : "Unknown error",
          errorStack:
            activityError instanceof Error ? activityError.stack : undefined,
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
 * Updates market metrics from CoinGecko (volume, price change)
 */
async function updateMarketMetrics(client: Client) {
  try {
    const tokenData = await fetchTokenPrice("scout-protocol-token");

    if (tokenData && client.user) {
      const volume24h = tokenData.usd_24h_vol || 0;
      const change24h = tokenData.usd_24h_change || 0;

      latestVolume = volume24h;
      latestPriceChange = change24h;

      try {
        // Update the full status with latest price and new market data
        const title = latestDevPrice
          ? `DEV $${latestDevPrice.toFixed(5)}`
          : "DEV Price";
        const description = `24h: ${
          change24h >= 0 ? "📈" : "📉"
        }${change24h.toFixed(2)}% || Vol: $${formatNumber(volume24h)}`;

        client.user.setActivity(title, {
          type: ActivityType.Watching,
          state: description,
        });

        logger.info(
          `[CronJob-MarketMetrics] Market metrics updated - Volume: $${formatNumber(
            volume24h
          )}, Change: ${change24h.toFixed(2)}%`
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
        "[CronJob-MarketMetrics] Failed to fetch market metrics from CoinGecko"
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

    // Schedule market metrics updates
    if (cron.validate(marketMetricsCron)) {
      cron.schedule(
        marketMetricsCron,
        () => {
          logger.info("[CronJob] Market metrics update triggered");
          updateMarketMetrics(client);
        },
        { timezone }
      );
      logger.info(
        `[CronJob] Market metrics updates scheduled every 8 minutes (${timezone})`
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
