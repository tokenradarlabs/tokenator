import logger from '../../utils/logger';
import prisma from '../../utils/prisma';

export interface DeleteAlertParams {
  alertId?: string;
  deleteDisabled?: boolean;
  type?: 'price' | 'volume' | 'all';
  guildId: string;
  channelId: string;
}

export interface DeleteAlertResult {
  success: boolean;
  message: string;
}

export async function deleteAlert(
  params: DeleteAlertParams
): Promise<DeleteAlertResult> {
  const { alertId, deleteDisabled, type, guildId, channelId } = params;

  if (!alertId && !deleteDisabled) {
    return {
      success: false,
      message: 'Please provide either an alert ID or use the delete-disabled option.',
    };
  }

  try {
    if (deleteDisabled) {
      // Bulk delete by type
      let whereClause: any = {
        discordServerId: guildId,
        channelId: channelId,
        enabled: false,
      };
      if (type === 'price') {
        whereClause.priceAlert = { isNot: null };
      } else if (type === 'volume') {
        whereClause.volumeAlert = { isNot: null };
      } else if (type === 'all') {
        whereClause.OR = [
          { priceAlert: { isNot: null } },
          { volumeAlert: { isNot: null } },
        ];
      }
      const disabledAlerts = await prisma.alert.findMany({
        where: whereClause,
        include: {
          priceAlert: true,
          volumeAlert: true,
        },
      });
      if (disabledAlerts.length === 0) {
        return {
          success: true,
          message: `No disabled ${type || ''} alerts found in this channel.`,
        };
      }
      let deletedCount = 0;
      for (const alert of disabledAlerts) {
        try {
          if (alert.priceAlert) {
            await prisma.priceAlert.delete({ where: { id: alert.priceAlert.id } });
          }
          if (alert.volumeAlert) {
            await prisma.volumeAlert.delete({ where: { id: alert.volumeAlert.id } });
          }
          await prisma.alert.delete({ where: { id: alert.id } });
          deletedCount++;
        } catch (err) {
          logger.error(`Error deleting alert ${alert.id}:`, err);
        }
      }
      return {
        success: true,
        message: `Successfully deleted ${deletedCount} disabled ${type || ''} alerts in this channel.`,
      };
    }
    if (alertId) {
      // Delete a specific alert by ID
      const alert = await prisma.alert.findFirst({
        where: {
          id: alertId,
          discordServerId: guildId,
          channelId: channelId,
        },
        include: {
          priceAlert: true,
          volumeAlert: true,
        },
      });
      if (!alert) {
        return {
          success: false,
          message: 'Alert not found for the given ID in this channel.',
        };
      }
      if (alert.priceAlert) {
        await prisma.priceAlert.delete({ where: { id: alert.priceAlert.id } });
      }
      if (alert.volumeAlert) {
        await prisma.volumeAlert.delete({ where: { id: alert.volumeAlert.id } });
      }
      await prisma.alert.delete({ where: { id: alert.id } });
      return {
        success: true,
        message: 'Alert deleted successfully.',
      };
    }
    return {
      success: false,
      message: 'No valid delete operation performed.',
    };
  } catch (error) {
    logger.error('Error deleting alert:', error);
    return {
      success: false,
      message: 'Failed to delete alert. Please try again later.',
    };
  }
}
