import prisma from '../../utils/prisma';
import { Alert, PriceAlert, Token } from '../../generated/prisma/client';

export async function findPriceAlertById(
  alertId: string,
  guildId: string
): Promise<(PriceAlert & { tokenId: string }) | null> {
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
    return null;
  }

  return {
    ...alert.priceAlert,
    tokenId: alert.token.id,
  };
}
