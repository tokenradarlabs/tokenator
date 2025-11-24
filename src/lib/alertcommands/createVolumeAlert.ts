import logger from '../../utils/logger';
import prisma from '../../utils/prisma';
import {
  isSupportedToken,
  resolveTokenAlias,
} from '../../utils/constants';
import { formatNumber } from '../../utils/coinGecko';
import { getTokenVolumeByTimeframe } from '../../utils/databaseVolume';

export interface CreateVolumeAlertParams {
  tokenId: string;
  direction: 'up' | 'down';
  value: number;
  guildId: string;
  channelId: string;
  guildName?: string;
  timeframe: '24h' | '7d' | '30d';
}

export interface CreateVolumeAlertResult {
  success: boolean;
  message: string;
  currentVolume?: number | null;
}

/**
 * Creates a new volume alert for a given token.
 * @param params - Parameters for creating the volume alert.
 * @returns A result object indicating success or failure and a message.
 */
export async function createVolumeAlert(
  params: CreateVolumeAlertParams
): Promise<CreateVolumeAlertResult> {
  const { tokenId, direction, value, guildId, channelId, guildName, timeframe } = params;

  if (!['24h', '7d', '30d'].includes(timeframe)) {
    return {
      success: false,
      message: '❌ **Invalid timeframe**: Timeframe must be one of \'24h\', \'7d\', or \'30d\'.',
    };
  }

  if (!isSupportedToken(tokenId)) {
    return {
      success: false,
      message: 'Unsupported token. Please use one of: DEV, BTC, or ETH.',
    };
  }

  // Validate volume value
  if (value <= 0) {
    return {
      success: false,
      message: '❌ **Invalid volume value**: Volume must be greater than 0.',
    };
  }

  if (value > 1000000000000) { // 1 trillion limit
    return {
      success: false,
      message: '❌ **Invalid volume value**: Volume cannot exceed 1 trillion.',
    };
  }

  try {
    const standardTokenId = resolveTokenAlias(tokenId);
    if (!standardTokenId) {
      throw new Error(`Unsupported token: ${tokenId}`);
    }

    // Get current volume for context
    const currentVolume = await getTokenVolumeByTimeframe(standardTokenId, timeframe);

    // Check if server exists, create if not
    await prisma.discordServer.upsert({
      where: { id: guildId },
      update: guildName ? { name: guildName } : {},
      create: { id: guildId, name: guildName },
    });

    // Create or get token
    const token = await prisma.token.upsert({
      where: { address: standardTokenId },
      update: {},
      create: { address: standardTokenId },
    });

    // Check for exact duplicate (same token + same direction + same value)
    const existingAlert = await prisma.alert.findFirst({
      where: {
        channelId,
        tokenId: token.id,
        volumeAlert: {
          direction,
          value,
        },
        enabled: true,
      },
      include: {
        volumeAlert: true,
        token: true,
      },
    });

    if (existingAlert && existingAlert.volumeAlert) {
      return {
        success: false,
        message: `❌ **Exact duplicate alert!** You already have this exact volume alert for **${tokenId.toUpperCase()}** in this channel.\n\n` +
          `**Existing Alert:**\n` +
          `• Direction: ${existingAlert.volumeAlert.direction.toUpperCase()} ${existingAlert.volumeAlert.direction === 'up' ? '📈' : '📉'}\n` +
          `• Threshold: ${formatNumber(existingAlert.volumeAlert.value)}\n\n` +
          `*You can create alerts with different thresholds or directions for the same token.*`,
      };
    }

    // Create the alert and volume alert
    const alert = await prisma.alert.create({
      data: {
        channelId,
        discordServerId: guildId,
        tokenId: token.id,
        volumeAlert: {
          create: {
            direction,
            value,
            timeframe,
          },
        },
      },
      include: {
        volumeAlert: true,
        token: true,
      },
    });

    const directionEmoji = direction === 'up' ? '📈' : '📉';
    const message = 
      `✅ **Volume Alert Created!** ${directionEmoji}\n\n` +
      `**Token:** ${tokenId.toUpperCase()}\n` +
      `**Direction:** ${direction.toUpperCase()} ${directionEmoji}\n` +
      `**Threshold:** ${formatNumber(value)}\n` +
      `**Timeframe:** ${timeframe}\n` +
      `**Current ${timeframe} Volume:** ${currentVolume ? formatNumber(currentVolume) : 'Unknown'}\n\n` +
      `You'll be notified when the ${timeframe} volume ${direction === 'up' ? 'rises above' : 'drops below'} ${formatNumber(value)}.\n` +
      `*Volume alerts are checked once daily.*`;

    logger.info(`[VolumeAlert] Created volume alert`, {
      alertId: alert.id,
      tokenId: standardTokenId,
      direction,
      value,
      timeframe,
      channelId,
      guildId,
    });

    return {
      success: true,
      message,
      currentVolume,
    };

  } catch (error) {
    logger.error({ err: error, tokenId, direction, value, timeframe, channelId, guildId }, '[VolumeAlert] Error creating volume alert');

    return {
      success: false,
      message: `❌ **Error creating volume alert**: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}