import logger from '../../utils/logger';
import prisma from '../../utils/prisma';

export interface DeletePriceAlertParams {
  alertId?: string;
  deleteDisabled?: boolean;
  guildId: string;
  channelId: string;
}

export interface DeletePriceAlertResult {
  success: boolean;
  message: string;
}

export async function deletePriceAlert(
  params: DeletePriceAlertParams
): Promise<DeletePriceAlertResult> {
  const { alertId, deleteDisabled, guildId, channelId } = params;

  if (!alertId && deleteDisabled !== true) {
    return {
      success: false,
      message: 'Please provide either an alert ID or use the delete-disabled option.',
    };
  }

  if (deleteDisabled === true) {
    return await deleteDisabledAlerts(guildId, channelId);
  }

  if (alertId) {
    return await deleteSpecificAlert(alertId, guildId, channelId);
  }

  return {
    success: false,
    message: 'Invalid parameters provided.',
  };
}

async function deleteDisabledAlerts(
  guildId: string,
  channelId: string
): Promise<DeletePriceAlertResult> {
  try {
    logger.info(`Attempting to delete all disabled alerts from guild ${guildId} channel ${channelId}`);

    const disabledAlerts = await prisma.alert.findMany({
      where: {
        discordServerId: guildId,
        channelId: channelId,
        enabled: false,
        priceAlert: {
          isNot: null,
        },
      },
      include: {
        priceAlert: true,
      },
    });

    if (disabledAlerts.length === 0) {
      return {
        success: true,
        message: 'No disabled alerts found in this channel.',
      };
    }

    logger.info(`Found ${disabledAlerts.length} disabled alerts to delete`);

    // Delete all disabled alerts
    let deletedCount = 0;
    for (const alert of disabledAlerts) {
      try {
        // Delete the PriceAlert first if it exists
        if (alert.priceAlert) {
          await prisma.priceAlert.delete({
            where: {
              alertId: alert.id,
            },
          });
        }

        deletedCount++;
      } catch (deleteError) {
        logger.error(`Error deleting disabled alert ${alert.id}:`, deleteError);
      }
    }

    logger.info(`Successfully deleted ${deletedCount} disabled alerts`);
    return {
      success: true,
      message: `Successfully deleted ${deletedCount} disabled alerts from this channel.`,
    };
  } catch (error) {
    logger.error('Error deleting disabled alerts:', {
      error,
      guildId,
      channelId,
    });

    let errorMessage = 'Sorry, there was an error deleting the disabled alerts.';
    if (error instanceof Error) {
      errorMessage += ` Error: ${error.message}`;
    }

    return {
      success: false,
      message: errorMessage,
    };
  }
}

async function deleteSpecificAlert(
  alertId: string,
  guildId: string,
  channelId: string
): Promise<DeletePriceAlertResult> {
  try {
    logger.info(`Attempting to delete alert ${alertId} from guild ${guildId} channel ${channelId}`);

    const alert = await prisma.alert.findFirst({
      where: {
        id: alertId,
        discordServerId: guildId,
        channelId: channelId,
      },
      include: {
        priceAlert: true,
      },
    }).catch(err => {
      logger.error('Error finding alert:', err);
      throw err;
    });

    if (!alert) {
      logger.info(`Alert ${alertId} not found or not accessible`);
      return {
        success: false,
        message: 'Alert not found or you do not have permission to delete it.',
      };
    }

    logger.info(`Found alert ${alertId}, has priceAlert: ${!!alert.priceAlert}`);

    try {
      if (alert.priceAlert) {
        logger.info(`Deleting PriceAlert for alert ${alertId}`);
        await prisma.priceAlert.delete({
          where: {
            alertId: alertId,
          },
        });
      }

      logger.info(`Deleting Alert ${alertId}`);
      await prisma.alert.delete({
        where: {
          id: alertId,
        },
      });

      logger.info(`Successfully deleted alert ${alertId}`);
      return {
        success: true,
        message: `Successfully deleted alert with ID: \`${alertId}\``,
      };
    } catch (deleteError) {
      logger.error('Error during delete operation:', deleteError);
      throw deleteError;
    }
  } catch (error) {
    logger.error('Error deleting price alert:', {
      error,
      alertId,
      guildId,
      channelId,
    });

    let errorMessage = 'Sorry, there was an error deleting the price alert.';
    if (error instanceof Error) {
      errorMessage += ` Error: ${error.message}`;
    }

    return {
      success: false,
      message: errorMessage,
    };
  }
}
