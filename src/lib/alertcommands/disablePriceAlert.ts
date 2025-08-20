import logger from '../../utils/logger';
import prisma from '../../utils/prisma';

export interface DisablePriceAlertParams {
  alertId?: string;
  disableAll?: boolean;
  guildId: string;
  channelId: string;
}

export interface DisablePriceAlertResult {
  success: boolean;
  message: string;
}

export async function disablePriceAlert(
  params: DisablePriceAlertParams
): Promise<DisablePriceAlertResult> {
  const { alertId, disableAll, guildId, channelId } = params;

  if (!alertId && disableAll !== true) {
    return {
      success: false,
      message: 'Please provide either an alert ID or use the disable-all option.',
    };
  }

  if (disableAll === true) {
    return await disableAllEnabledAlerts(guildId, channelId);
  }

  if (alertId) {
    return await disableSpecificAlert(alertId, guildId, channelId);
  }

  return {
    success: false,
    message: 'Invalid parameters provided.',
  };
}

async function disableAllEnabledAlerts(
  guildId: string,
  channelId: string
): Promise<DisablePriceAlertResult> {
  try {
    logger.info(`Attempting to disable all enabled alerts from guild ${guildId} channel ${channelId}`);

    const enabledAlerts = await prisma.alert.findMany({
      where: {
        discordServerId: guildId,
        channelId: channelId,
        enabled: true,
        priceAlert: {
          isNot: null,
        },
      },
    });

    if (enabledAlerts.length === 0) {
      return {
        success: true,
        message: 'No enabled alerts found in this channel.',
      };
    }

    logger.info(`Found ${enabledAlerts.length} enabled alerts to disable`);

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

    logger.info(`Successfully disabled ${disabledCount} alerts`);
    return {
      success: true,
      message: `Successfully disabled ${disabledCount} alerts in this channel.`,
    };
  } catch (error) {
    logger.error('Error disabling all enabled alerts:', {
      error,
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
): Promise<DisablePriceAlertResult> {
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
