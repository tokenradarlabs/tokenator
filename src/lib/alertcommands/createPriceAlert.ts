import logger from '../../utils/logger';
import prisma from '../../utils/prisma';
import { getLatestTokenPriceFromDatabase } from '../../utils/databasePrice';
import {
  isSupportedToken,
  getStandardizedTokenId,
} from '../../utils/constants';
import { validatePriceAlertValue } from '../../utils/priceValidation';
import { formatPriceForDisplay } from '../../utils/priceFormatter';

export interface CreatePriceAlertParams {
  tokenId: string;
  direction: 'up' | 'down';
  value: number;
  guildId: string;
  channelId: string;
  guildName?: string;
}

export interface CreatePriceAlertResult {
  success: boolean;
  message: string;
  currentPrice?: number | null;
}

export async function createPriceAlert(
  params: CreatePriceAlertParams
): Promise<CreatePriceAlertResult> {
  const { tokenId, direction, value, guildId, channelId, guildName } = params;

  if (!isSupportedToken(tokenId)) {
    return {
      success: false,
      message: 'Unsupported token. Please use one of: DEV, BTC, or ETH.',
    };
  }

  const validationResult = await validatePriceAlertValue(
    tokenId,
    value,
    direction
  );
  if (!validationResult.isValid) {
    return {
      success: false,
      message: `❌ **Invalid price value**: ${validationResult.errorMessage}`,
    };
  }

  try {
    const standardizedId = getStandardizedTokenId(tokenId);
    if (!standardizedId) {
      throw new Error(`Unsupported token: ${tokenId}`);
    }

    const alert = await prisma.$transaction(async (tx) => {
      // Upsert DiscordServer
      await tx.discordServer.upsert({
        where: { id: guildId },
        update: { name: guildName },
        create: { id: guildId, name: guildName },
      });

      // Upsert Token
      await tx.token.upsert({
        where: { address: standardizedId },
        update: {},
        create: { address: standardizedId },
      });

      // Find or create the base Alert
      return await tx.alert.upsert({
        where: { discordServerId_channelId_tokenId: { discordServerId: guildId, channelId, tokenId: standardizedId } },
        update: {},
        create: {
          channelId: channelId,
          enabled: true,
          discordServerId: guildId,
          tokenId: standardizedId,
        },
      });
    });

    // Create the PriceAlert associated with the base Alert
    await prisma.priceAlert.create({
      data: {
        direction: direction,
        value: value,
        alertId: alert.id,
      },
    });

    const directionEmoji = direction === 'up' ? '📈' : '📉';
    const price =
      validationResult.currentPrice ||
      (await getLatestTokenPriceFromDatabase(tokenId));

    if (price !== null) {
      logger.info(`[CreateAlert] Using price for ${tokenId}: ${formatPriceForDisplay(price)}`);
      return {
        success: true,
        message: `✅ Alert created! I will notify you in this channel when the price of **${tokenId}** goes ${direction} to \`${formatPriceForDisplay(value)}\`. ${directionEmoji} Current price: \`${formatPriceForDisplay(price)}\``,
        currentPrice: price,
      };
    } else {
      logger.warn(
        `[CreateAlert] No price available for ${tokenId}, alert created without current price display`
      );
      return {
        success: true,
        message: `✅ Alert created successfully! I couldn't fetch the current price right now, but the alert will work once price data is available.`,
        currentPrice: null,
      };
    }
  } catch (error: any) {
    logger.error('Error creating price alert:', error);
    if (error.code === 'P2002') {
      // P2002 is the error code for unique constraint violation
      if (error.meta?.target?.includes('alertId_direction_value')) {
        return {
          success: false,
          message: `You already have an identical price alert for **${tokenId}** at \`${formatPriceForDisplay(value)}\` going ${direction}.`,
        };
      } else if (error.meta?.target?.includes('discordServerId_channelId_tokenId')) {
        return {
          success: false,
          message: `You already have a base alert for **${tokenId}** in this channel. You can add more specific price alerts to it.`,
        };
      }
    }
    return {
      success: false,
      message: 'Sorry, there was an error creating the price alert. Please try again later.',
    };
  }
}
