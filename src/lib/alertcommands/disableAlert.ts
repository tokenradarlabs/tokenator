import logger from '../../utils/logger';
import prisma from '../../utils/prisma';

export interface DisableAlertParams {
  alertId?: string;
  disableType?: 'all' | 'price' | 'volume';
  guildId: string;
  channelId: string;
}

export interface DisableAlertResult {
  success: boolean;
  message: string;
}

export async function disableAlert(
  params: DisableAlertParams
): Promise<DisableAlertResult> {
  const { alertId, disableType, guildId, channelId } = params;

  if (!alertId && !disableType) {
    return {
      success: false,
      message: 'Please provide either an alert ID or select a disable type.',
    };
  }

  if (disableType) {
    return await disableEnabledAlertsByType(guildId, channelId, disableType);
  }

  if (alertId) {
    return await disableSpecificAlert(alertId, guildId, channelId);
  }

  return {
    success: false,
    message: 'Invalid parameters provided.',
  };
}

async function disableEnabledAlertsByType(
  guildId: string,
  channelId: string,
  disableType: 'all' | 'price' | 'volume'
): Promise<DisableAlertResult> {
  try {
    logger.info(`Attempting to disable ${disableType} enabled alerts from guild ${guildId} channel ${channelId}`);

    // Build the where clause based on the type
    const baseWhereClause = {
      discordServerId: guildId,
      channelId: channelId,
      enabled: true,
    };

    let whereClause: any;
    
    if (disableType === 'all') {
      whereClause = {
        ...baseWhereClause,
        OR: [
          {
            priceAlert: {
              isNot: null,
            },
          },
          {
            volumeAlert: {
              isNot: null,
            },
          },
        ],
      };
    } else if (disableType === 'price') {
      whereClause = {
        ...baseWhereClause,
        priceAlert: {
          isNot: null,
        },
      };
    } else if (disableType === 'volume') {
      whereClause = {
        ...baseWhereClause,
        volumeAlert: {
          isNot: null,
        },
      };
    }

    const enabledAlerts = await prisma.alert.findMany({
      where: whereClause,
      include: {
        priceAlert: true,
        volumeAlert: true,
      },
    });

    if (enabledAlerts.length === 0) {
      const typeText = disableType === 'all' ? '' : ` ${disableType}`;
      return {
        success: true,
        message: `No enabled${typeText} alerts found in this channel.`,
      };
    }

    logger.info(`Found ${enabledAlerts.length} enabled ${disableType} alerts to disable`);

    let disabledCount = 0;
    for (const alert of enabledAlerts) {
      try {
        await prisma.alert.update({
          where: { id: alert.id },
          data: { enabled: false },
        });
        disabledCount++;
      } catch (updateError) {
        logger.error(`Error disabling alert ${alert.id}:`, updateError);
      }
    }

    logger.info(`Successfully disabled ${disabledCount} ${disableType} alerts`);
    const typeText = disableType === 'all' ? '' : ` ${disableType}`;
    return {
      success: true,
      message: `Successfully disabled ${disabledCount}${typeText} alerts in this channel.`,
    };
  } catch (error) {
    logger.error('Error disabling enabled alerts:', {
      error,
      disableType,
      guildId,
      channelId,
    });

    let errorMessage = 'Sorry, there was an error disabling the alerts.';
    if (error instanceof Error) {
      errorMessage += ` Error: ${error.message}`;
    }

    return {
      success: false,
      message: errorMessage,
    };
  }
}

async function disableSpecificAlert(
  alertId: string,
  guildId: string,
  channelId: string
): Promise<DisableAlertResult> {
  try {
    logger.info(`Attempting to disable alert ${alertId} from guild ${guildId} channel ${channelId}`);

    const alert = await prisma.alert.findFirst({
      where: {
        id: alertId,
        discordServerId: guildId,
        channelId: channelId,
      },
    }).catch(err => {
      logger.error('Error finding alert:', err);
      throw err;
    });

    if (!alert) {
      logger.info(`Alert ${alertId} not found or not accessible`);
      return {
        success: false,
        message: 'Alert not found or you do not have permission to disable it.',
      };
    }

    if (!alert.enabled) {
      logger.info(`Alert ${alertId} is already disabled.`);
      return {
        success: true,
        message: `Alert with ID: \`${alertId}\` is already disabled.`,
      };
    }

    try {
      await prisma.alert.update({
        where: { id: alertId },
        data: { enabled: false },
      });

      logger.info(`Successfully disabled alert ${alertId}`);
      return {
        success: true,
        message: `Successfully disabled alert with ID: \`${alertId}\``,
      };
    } catch (updateError) {
      logger.error('Error during disable operation:', updateError);
      throw updateError;
    }
  } catch (error) {
    logger.error('Error disabling price alert:', {
      error,
      alertId,
      guildId,
      channelId,
    });

    let errorMessage = 'Sorry, there was an error disabling the price alert.';
    if (error instanceof Error) {
      errorMessage += ` Error: ${error.message}`;
    }

    return {
      success: false,
      message: errorMessage,
    };
  }
}

// Backward compatibility exports
export { disableAlert as disablePriceAlert };
export type { DisableAlertParams as DisablePriceAlertParams };
export type { DisableAlertResult as DisablePriceAlertResult };
