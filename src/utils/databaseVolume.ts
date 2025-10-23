import prisma from './prisma';
import logger from './logger';

/**
 * Gets the latest volume for a token from the database
 * @param tokenId The standardized token ID (e.g., 'scout-protocol-token')
 * @returns The latest volume or null if not found
 */
export async function get24hTokenVolumeFromDatabase(
  tokenId: string
): Promise<number | null> {
  try {
    const latestVolume = await prisma.tokenVolume.findFirst({
      where: {
        token: { address: tokenId },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    if (!latestVolume) {
      logger.warn(`[DatabaseVolume] No volume data found for token: ${tokenId}`);
      return null;
    }

    logger.info(`[DatabaseVolume] Latest volume for ${tokenId}: ${latestVolume.volume}`);
    return latestVolume.volume;

  } catch (error) {
    logger.error(
      `[DatabaseVolume] Error fetching latest volume for token: ${tokenId}`,
      error as Error
    );
    return null;
  }
}

/**
 * Gets the volume history for a token from the database
 * @param tokenId The standardized token ID
 * @param limit The maximum number of records to return
 * @returns Array of volume records
 */
export async function getTokenVolumeHistory(
  tokenId: string,
  limit: number = 30
): Promise<Array<{ volume: number; timestamp: Date }>> {
  try {
    const volumeHistory = await prisma.tokenVolume.findMany({
      where: {
        token: { address: tokenId },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      select: {
        volume: true,
        timestamp: true,
      },
    });

    logger.info(`[DatabaseVolume] Fetched ${volumeHistory.length} volume records for ${tokenId}`);
    return volumeHistory;

  } catch (error) {
    logger.error(
      `[DatabaseVolume] Error fetching volume history for token: ${tokenId}`,
      error as Error
    );
    return [];
  }
}
