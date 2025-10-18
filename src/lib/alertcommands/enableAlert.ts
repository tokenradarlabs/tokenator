import logger from '../../utils/logger';
import prisma from '../../utils/prisma';

export interface EnableAlertParams {
  alertId?: string;
  enableType?: 'all' | 'price' | 'volume';
  guildId: string;
  channelId: string;
}

export interface EnableAlertResult {
  success: boolean;
  message: string;
}

/**
 * Enables a disabled alert or a group of disabled alerts by type.
 * @param params - Parameters for enabling alerts.
 * @returns A result object indicating success or failure and a message.
 */
export async function enableAlert(
  params: EnableAlertParams
): Promise<EnableAlertResult> {
  const { alertId, enableType, guildId, channelId } = params;

  if (!alertId && !enableType) {
    return {
      success: false,
      message: 'Please provide either an alert ID or select an enable type.',
    };
  }

  if (enableType) {
    return await enableDisabledAlertsByType(guildId, channelId, enableType);
  }

  if (alertId) {
    return await enableSpecificAlert(alertId, guildId, channelId);
  }

  return {
    success: false,
    message: 'Invalid parameters provided.',
  };
}

async function enableDisabledAlertsByType(
  guildId: string,
  channelId: string,
  enableType: 'all' | 'price' | 'volume'
): Promise<EnableAlertResult> {
  try {
    logger.info(`Attempting to enable ${enableType} disabled alerts from guild ${guildId} channel ${channelId}`);

    // Build the where clause based on the type
    const baseWhereClause = {
      discordServerId: guildId,
      channelId: channelId,
      enabled: false,
    };

    let whereClause: any;
    
    if (enableType === 'all') {
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
    } else if (enableType === 'price') {
      whereClause = {
        ...baseWhereClause,
        priceAlert: {
          isNot: null,
        },
      };
    } else if (enableType === 'volume') {
      whereClause = {
        ...baseWhereClause,
        volumeAlert: {
          isNot: null,
        },
      };
    }

    const disabledAlerts = await prisma.alert.findMany({
      where: whereClause,
      include: {
        priceAlert: true,
        volumeAlert: true,
      },
    });

    if (disabledAlerts.length === 0) {
      const typeText = enableType === 'all' ? '' : ` ${enableType}`;
      return {
        success: true,
        message: `No disabled${typeText} alerts found in this channel.`,
      };
    }

    logger.info(`Found ${disabledAlerts.length} disabled ${enableType} alerts to enable`);

    let enabledCount = 0;
    for (const alert of disabledAlerts) {
      try {
        await prisma.alert.update({
          where: { id: alert.id },
          data: {
            enabled: true,
            lastTriggered: null,
          },
        });
        enabledCount++;
      } catch (updateError) {
        logger.error(`Error enabling alert ${alert.id}:`, updateError);
      }
    }

    logger.info(`Successfully enabled ${enabledCount} ${enableType} alerts`);
    const typeText = enableType === 'all' ? '' : ` ${enableType}`;
    return {
      success: true,
      message: `Successfully enabled ${enabledCount}${typeText} alerts in this channel.`,
    };
  } catch (error) {
    logger.error('Error enabling disabled alerts:', {
      error,
      enableType,
      guildId,
      channelId,
    });

    let errorMessage = 'Sorry, there was an error enabling the alerts.';
    if (error instanceof Error) {
      errorMessage += ` Error: ${error.message}`;
    }

    return {
      success: false,
      message: errorMessage,
    };
  }
}

async function enableSpecificAlert(
  alertId: string,
  guildId: string,
  channelId: string
): Promise<EnableAlertResult> {
  try {
    logger.info(
      `Attempting to enable alert ${alertId} from guild ${guildId} channel ${channelId}`
    );

    const alert = await prisma.alert
      .findFirst({
        where: {
          id: alertId,
          discordServerId: guildId,
          channelId: channelId,
        },
      })
      .catch(err => {
        logger.error('Error finding alert:', err);
        throw err;
      });

    if (!alert) {
      logger.info(`Alert ${alertId} not found or not accessible`);
      return {
        success: false,
        message: 'Alert not found or you do not have permission to enable it.',
      };
    }

    if (alert.enabled) {
      logger.info(`Alert ${alertId} is already enabled.`);
      return {
        success: true,
        message: `Alert with ID: \`${alertId}\` is already enabled.`,
      };
    }

    try {
      await prisma.alert.update({
        where: { id: alertId },
        data: {
          enabled: true,
          lastTriggered: null,
        },
      });

      logger.info(`Successfully enabled alert ${alertId} and reset cooldown`);
      return {
        success: true,
        message: `Successfully enabled alert with ID: \`${alertId}\``,
      };
    } catch (updateError) {
      logger.error('Error during enable operation:', updateError);
      throw updateError;
    }
  } catch (error) {
    logger.error('Error enabling price alert:', {
      error,
      alertId,
      guildId,
      channelId,
    });

    let errorMessage = 'Sorry, there was an error enabling the alert.';
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
export type EnablePriceAlertParams = EnableAlertParams;
export type EnablePriceAlertResult = EnableAlertResult;

// Backward compatibility function that maps old enableAll boolean to new enableType
/**
 * Enables a disabled price alert or all disabled price alerts. (Backward compatibility function)
 * @param params - Parameters for enabling price alerts.
 * @returns A result object indicating success or failure and a message.
 */
export const enablePriceAlert = (params: EnableAlertParams | { alertId?: string; enableAll?: boolean; guildId: string; channelId: string; }): Promise<EnableAlertResult> => {
  // Handle both old and new parameter formats
  if ('enableAll' in params && params.enableAll) {
    return enableAlert({
      alertId: params.alertId,
      enableType: 'all',
      guildId: params.guildId,
      channelId: params.channelId,
    });
  }
  
  return enableAlert(params as EnableAlertParams);
};
