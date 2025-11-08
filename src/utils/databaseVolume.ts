import prisma from './prisma';
import logger from './logger';
import { Token, TokenVolume } from "../generated/prisma";

/**
 * Gets the latest volume for a token from the database based on the specified timeframe.
 * @param tokenId The standardized token ID (e.g., 'scout-protocol-token')
 * @param timeframe The desired timeframe for the volume ('24h', '7d', '30d')
 * @returns The latest volume for the specified timeframe or null if not found
 */
export async function getTokenVolumeByTimeframe(
  tokenId: string,
  timeframe: '24h' | '7d' | '30d'
): Promise<number | null> {
  try {
    const latestVolume: TokenVolume | null = await prisma.tokenVolume.findFirst({
      where: { token: { address: tokenId } },
      orderBy: { timestamp: 'desc' },
    });

    if (!latestVolume) {
      logger.warn(`[DatabaseVolume] No volume data found for token: ${tokenId}`);
      return null;
    }

    switch (timeframe) {
      case '24h':
        return latestVolume.volume ?? null;
      case '7d':
        return latestVolume.volume7d ?? null;
      case '30d':
        return latestVolume.volume30d ?? null;
    }
  } catch (error) {
    logger.error(`[DatabaseVolume] Error fetching ${timeframe} volume for token: ${tokenId}`, error);
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
    const volumeHistory: Array<{ volume: number; timestamp: Date }> = await prisma.tokenVolume.findMany({
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
