import logger from '../../utils/logger';
import prisma from '../../utils/prisma';
import { AlertDirection } from '../../generated/prisma/client';

export interface EditVolumeAlertParams {
  alertId: string;
  newDirection?: AlertDirection;
  newValue?: number;
  guildId: string;
  channelId: string;
}

export interface EditVolumeAlertResult {
  success: boolean;
  message: string;
}

/**
 * Edits an existing volume alert.
 * @param params - Parameters for editing the volume alert.
 * @returns A result object indicating success or failure and a message.
 */
export async function editVolumeAlert(
  params: EditVolumeAlertParams
): Promise<EditVolumeAlertResult> {
  const { alertId, newDirection, newValue, guildId, channelId } = params;

  if (!alertId) {
    return {
      success: false,
      message: 'Alert ID is required.',
    };
  }

  try {
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

    const updated = await prisma.volumeAlert.update({
      where: { id: alert.volumeAlert.id },
      data: {
        direction: newDirection || alert.volumeAlert.direction,
        value: newValue !== undefined ? newValue : alert.volumeAlert.value,
      },
    });

    logger.info(`Volume alert ${alertId} updated:`, updated);
    return {
      success: true,
      message: 'Volume alert updated successfully.',
    };
  } catch (error) {
    logger.error('Error editing volume alert:', error);
    return {
      success: false,
      message: 'Failed to update volume alert. Please try again later.',
    };
  }
}
