import logger from '../../utils/logger';
import prisma from '../../utils/prisma';

export interface DeleteVolumeAlertParams {
  alertId?: string;
  deleteDisabled?: boolean;
  guildId: string;
  channelId: string;
}

export interface DeleteVolumeAlertResult {
  success: boolean;
  message: string;
}

export async function deleteVolumeAlert(
  params: DeleteVolumeAlertParams
): Promise<DeleteVolumeAlertResult> {
  const { alertId, deleteDisabled, guildId, channelId } = params;

  if (!alertId && !deleteDisabled) {
    return {
      success: false,
      message: 'Please provide either a volume alert ID or use the delete-disabled option.',
    };
  }

  try {
    if (deleteDisabled) {
      // Delete all disabled volume alerts in this channel
      const disabledAlerts = await prisma.alert.findMany({
        where: {
          discordServerId: guildId,
          channelId: channelId,
          enabled: false,
          volumeAlert: {
            isNot: null,
          },
        },
        include: {
          volumeAlert: true,
        },
      });

      if (disabledAlerts.length === 0) {
        return {
          success: true,
          message: 'No disabled volume alerts found in this channel.',
        };
      }

      let deletedCount = 0;
      for (const alert of disabledAlerts) {
        try {
          if (alert.volumeAlert) {
            await prisma.volumeAlert.delete({ where: { id: alert.volumeAlert.id } });
          }
          await prisma.alert.delete({ where: { id: alert.id } });
          deletedCount++;
        } catch (err) {
          logger.error(`Error deleting volume alert ${alert.id}:`, err);
        }
      }
      return {
        success: true,
        message: `Successfully deleted ${deletedCount} disabled volume alerts in this channel.`,
      };
    }

    if (alertId) {
      // Delete a specific volume alert by ID
      const alert = await prisma.alert.findFirst({
        where: {
          id: alertId,
          discordServerId: guildId,
          channelId: channelId,
          volumeAlert: {
            isNot: null,
          },
        },
        include: {
          volumeAlert: true,
        },
      });

      if (!alert || !alert.volumeAlert) {
        return {
          success: false,
          message: 'Volume alert not found for the given ID in this channel.',
        };
      }

      await prisma.volumeAlert.delete({ where: { id: alert.volumeAlert.id } });
      await prisma.alert.delete({ where: { id: alert.id } });
      return {
        success: true,
        message: 'Volume alert deleted successfully.',
      };
    }

    return {
      success: false,
      message: 'No valid delete operation performed.',
    };
  } catch (error) {
    logger.error('Error deleting volume alert:', error);
    return {
      success: false,
      message: 'Failed to delete volume alert. Please try again later.',
    };
  }
}
