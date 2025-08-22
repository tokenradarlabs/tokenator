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
    await prisma.$transaction(async prisma => {
      const server = await prisma.discordServer.upsert({
        where: { id: guildId },
        update: { name: guildName },
        create: { id: guildId, name: guildName },
      });

      const standardizedId = getStandardizedTokenId(tokenId);
      if (!standardizedId) {
        throw new Error(`Unsupported token: ${tokenId}`);
      }

      const token = await prisma.token.upsert({
        where: { address: standardizedId },
        update: {},
        create: { address: standardizedId },
      });

      await prisma.alert.create({
        data: {
          channelId: channelId,
          enabled: true,
          discordServerId: server.id,
          tokenId: token.id,
          priceAlert: {
            create: {
              direction: direction,
              value: value,
            },
          },
        },
      });
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
  } catch (error) {
    logger.error('Error creating price alert:', error);
    return {
      success: false,
      message: 'Sorry, there was an error creating the price alert. Please try again later.',
    };
  }
}
