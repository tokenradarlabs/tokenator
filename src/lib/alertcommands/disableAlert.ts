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

/**
 * Disables an alert or a group of alerts by type.
 * @param params - Parameters for disabling alerts.
 * @returns A result object indicating success or failure and a message.
 */
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

    // If no enabled alerts are found for the specified type, it's a no-op.
    if (enabledAlerts.length === 0) {
      const typeText = disableType === 'all' ? '' : ` ${disableType}`;
      return {
        success: true,
        message: `No enabled${typeText} alerts found in this channel to disable. No changes were made.`,
      };
    }

    logger.info(`Found ${enabledAlerts.length} enabled ${disableType} alerts to disable`);

    // TODO: N+1 Query - Batch update alerts instead of individual updates in the loop.
    // Consider using prisma.alert.updateMany({ where: { id: { in: enabledAlertIds } }, data: { enabled: false } })
    const enabledAlertIds = enabledAlerts.map(alert => alert.id);
    let disabledCount = 0;

    if (enabledAlertIds.length > 0) {
      const result = await prisma.alert.updateMany({
        where: {
          id: { in: enabledAlertIds },
        },
        data: {
          enabled: false,
        },
      });
      disabledCount = result.count;
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

    // If the alert is already disabled, it's a no-op and we return a success status with an informative message.
    if (!alert.enabled) {
      logger.info(`Alert ${alertId} is already disabled. No action taken.`);
      return {
        success: true,
        message: `Alert with ID: \`${alertId}\` is already disabled. No changes were made.`,
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
