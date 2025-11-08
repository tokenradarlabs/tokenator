import { PrismaClient, Alert, PriceAlert, Token } from '../../generated/prisma';

type FindPriceAlertResult =
  | { success: true; alert: PriceAlert & { tokenId: string } }
  | { success: false; error: string };

/**
 * Finds a price alert by its ID and guild ID.
 * @param prisma - The Prisma client instance.
 * @param alertId - The ID of the alert.
 * @param guildId - The ID of the Discord guild.
 * @returns A structured result indicating success or failure, with the price alert and token ID if successful.
 */
export async function findPriceAlertById(
  prisma: PrismaClient,
  alertId: string,
  guildId: string
): Promise<FindPriceAlertResult> {
  try {
    const alert = await prisma.alert.findUnique({
      where: {
        id: alertId,
        discordServerId: guildId,
      },
      include: {
        priceAlert: true,
        token: true,
      },
    }) as (Alert & { priceAlert: PriceAlert | null; token: Token }) | null;

    if (!alert || !alert.priceAlert) {
      return { success: false, error: 'Price alert not found.' };
    }

    return {
      success: true,
      alert: {
        ...alert.priceAlert,
        tokenId: alert.token.id,
      },
    };
  } catch (error) {
    console.error('Error finding price alert:', error);
    return { success: false, error: 'An unexpected error occurred while finding the price alert.' };
  }
}
