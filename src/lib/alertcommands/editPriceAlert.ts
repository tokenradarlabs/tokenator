import logger from '../../utils/logger';
import prisma from '../../utils/prisma';
import { PriceAlertDirection } from '../../generated/prisma/client';
import { validatePriceAlertValue } from '../../utils/priceValidation';

export interface EditPriceAlertParams {
  alertId: string;
  newDirection?: PriceAlertDirection;
  newValue?: number;
  guildId: string;
  channelId: string;
}

export interface EditPriceAlertResult {
  success: boolean;
  message: string;
}

export async function editPriceAlert(
  params: EditPriceAlertParams
): Promise<EditPriceAlertResult> {
  const { alertId, newDirection, newValue, guildId, channelId } = params;

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
        token: true,
      },
    });

    if (!alert || !alert.priceAlert) {
      return {
        success: false,
        message: 'Price alert not found or you do not have permission to edit it in this channel.',
      };
    }

    if (newValue !== null && newValue !== undefined) {
      const directionToValidate = newDirection || alert.priceAlert.direction;
      const tokenAddress = alert.token.address;

      const validationResult = await validatePriceAlertValue(
        tokenAddress,
        newValue,
        directionToValidate
      );
      if (!validationResult.isValid) {
        return {
          success: false,
          message: `❌ **Invalid price value**: ${validationResult.errorMessage}`,
        };
      }
    }

    if (newDirection && (newValue === null || newValue === undefined)) {
      const tokenAddress = alert.token.address;
      const currentValue = alert.priceAlert.value;

      const validationResult = await validatePriceAlertValue(
        tokenAddress,
        currentValue,
        newDirection
      );
      if (!validationResult.isValid) {
        return {
          success: false,
          message: `❌ **Invalid direction change**: ${validationResult.errorMessage}`,
        };
      }
    }

    const updateData: { direction?: PriceAlertDirection; value?: number } = {};
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
