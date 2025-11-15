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

/**
 * Deletes an alert or multiple disabled alerts.
 * @param params - Parameters for deleting alerts.
 * @returns A result object indicating success or failure and a message.
 */
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
      const alertIdsToDelete: string[] = [];
      const priceAlertIdsToDelete: string[] = [];
      const volumeAlertIdsToDelete: string[] = [];

      for (const alert of disabledAlerts) {
        alertIdsToDelete.push(alert.id);
        if (alert.priceAlert) {
          priceAlertIdsToDelete.push(alert.priceAlert.id);
        }
        if (alert.volumeAlert) {
          volumeAlertIdsToDelete.push(alert.volumeAlert.id);
        }
      }

      // TODO: N+1 Query - Batch delete priceAlerts, volumeAlerts, and then alerts instead of individual deletes in the loop.
      // Consider using prisma.priceAlert.deleteMany, prisma.volumeAlert.deleteMany, and prisma.alert.deleteMany
      if (priceAlertIdsToDelete.length > 0) {
        await prisma.priceAlert.deleteMany({ where: { id: { in: priceAlertIdsToDelete } } });
      }
      if (volumeAlertIdsToDelete.length > 0) {
        await prisma.volumeAlert.deleteMany({ where: { id: { in: volumeAlertIdsToDelete } } });
      }
      if (alertIdsToDelete.length > 0) {
        const result = await prisma.alert.deleteMany({ where: { id: { in: alertIdsToDelete } } });
        deletedCount = result.count;
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
          message: `No alert found with ID: \`${alertId}\`.`,
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
    logger.error(error, 'Error deleting alert:');
    return {
      success: false,
      message: 'Failed to delete alert. Please try again later.',
    };
  }
}
