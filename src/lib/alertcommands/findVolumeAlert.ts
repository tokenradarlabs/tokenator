import prisma from '../../utils/prisma';
import { Alert, VolumeAlert, Token } from '../../generated/prisma/client';

/**
 * Finds a volume alert by its ID and guild ID.
 * @param alertId - The ID of the alert.
 * @param guildId - The ID of the Discord guild.
 * @returns The volume alert with token ID, or null if not found.
 */
export async function findVolumeAlertById(
  alertId: string,
  guildId: string
): Promise<(VolumeAlert & { tokenId: string }) | null> {
  const alert = await prisma.alert.findFirst({
    where: {
      id: alertId,
      discordServerId: guildId,
    },
    include: {
      volumeAlert: true,
      token: true,
    },
  }) as (Alert & { volumeAlert: VolumeAlert | null; token: Token }) | null;

  if (!alert || !alert.volumeAlert) {
    return null;
  }

  return {
    ...alert.volumeAlert,
    tokenId: alert.token.id,
  };
}
