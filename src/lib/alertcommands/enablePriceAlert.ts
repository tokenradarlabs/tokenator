import logger from '../../utils/logger';
import prisma from '../../utils/prisma';

export interface EnablePriceAlertParams {
  alertId?: string;
  enableAll?: boolean;
  guildId: string;
  channelId: string;
}

export interface EnablePriceAlertResult {
  success: boolean;
  message: string;
}

export async function enablePriceAlert(
  params: EnablePriceAlertParams
): Promise<EnablePriceAlertResult> {
  const { alertId, enableAll, guildId, channelId } = params;

  if (!alertId && enableAll !== true) {
    return {
      success: false,
      message: 'Please provide either an alert ID or use the enable-all option.',
    };
  }

  if (enableAll === true) {
    return await enableAllDisabledAlerts(guildId, channelId);
  }

  if (alertId) {
    return await enableSpecificAlert(alertId, guildId, channelId);
  }

  return {
    success: false,
    message: 'Invalid parameters provided.',
  };
}

async function enableAllDisabledAlerts(
  guildId: string,
  channelId: string
): Promise<EnablePriceAlertResult> {
  try {
    logger.info(`Attempting to enable all disabled alerts from guild ${guildId} channel ${channelId}`);

    const disabledAlerts = await prisma.alert.findMany({
      where: {
        discordServerId: guildId,
        channelId: channelId,
        enabled: false,
        priceAlert: {
          isNot: null,
        },
      },
    });

    if (disabledAlerts.length === 0) {
      return {
        success: true,
        message: 'No disabled alerts found in this channel.',
      };
    }

    logger.info(`Found ${disabledAlerts.length} disabled alerts to enable`);

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

    logger.info(`Successfully enabled ${enabledCount} alerts`);
    return {
      success: true,
      message: `Successfully enabled ${enabledCount} alerts in this channel.`,
    };
  } catch (error) {
    logger.error('Error enabling all disabled alerts:', {
      error,
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
): Promise<EnablePriceAlertResult> {
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

    let errorMessage = 'Sorry, there was an error enabling the price alert.';
    if (error instanceof Error) {
      errorMessage += ` Error: ${error.message}`;
    }

    return {
      success: false,
      message: errorMessage,
    };
  }
}
