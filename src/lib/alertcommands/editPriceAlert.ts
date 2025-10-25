import logger from '../../utils/logger';
import prisma from '../../utils/prisma';
import { AlertDirection } from '../../generated/prisma/client';
import { validatePriceAlertValue } from '../../utils/priceValidation';

export interface EditPriceAlertParams {
  alertId: string;
  newDirection?: AlertDirection;
  newValue?: number;
  guildId: string;
  channelId: string;
  tokenId: string;
}

export interface EditPriceAlertResult {
  success: boolean;
  message: string;
}

/**
 * Edits an existing price alert.
 * @param params - Parameters for editing the price alert.
 * @returns A result object indicating success or failure and a message.
 */
export async function editPriceAlert(
  params: EditPriceAlertParams
): Promise<EditPriceAlertResult> {
  const { alertId, newDirection, newValue, guildId, channelId, tokenId } = params;

  if (!newDirection && (newValue === null || newValue === undefined)) {
    return {
      success: false,
      message: 'You must provide a new direction or a new value to update.',
    };
  }

  try {
    const alert = await prisma.alert.findFirst({
      where: {
        id: alertId,
        discordServerId: guildId,
        channelId: channelId,
      },
      include: {
        priceAlert: true,
      },
    });

    if (!alert || !alert.priceAlert) {
      return {
        success: false,
        message: 'Price alert not found or you do not have permission to edit it in this channel.',
      };
    }

    const directionToValidate = newDirection || alert.priceAlert.direction;
    const valueToValidate = newValue ?? alert.priceAlert.value;

    const validationResult = await validatePriceAlertValue(
      tokenId,
      valueToValidate,
      directionToValidate
    );
    if (!validationResult.isValid) {
      return {
        success: false,
        message: `❌ **Invalid price alert**: ${validationResult.errorMessage}`,
      };
    }

    const updateData: { direction?: AlertDirection; value?: number } = {};
    if (newDirection) {
      updateData.direction = newDirection;
    }
    if (newValue !== null && newValue !== undefined) {
      updateData.value = newValue;
    }

    await prisma.priceAlert.update({
      where: {
        id: alert.priceAlert.id,
      },
      data: updateData,
    });

    return {
      success: true,
      message: `✅ Successfully updated alert with ID: \`${alertId}\`.`,
    };
  } catch (error) {
    logger.error('Error editing price alert:', error);
    return {
      success: false,
      message: 'Sorry, there was an error editing the price alert.',
    };
  }
}
