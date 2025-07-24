import prisma from "./prisma";
import logger from "./logger";

// Supported tokens and their normalized IDs  
const SUPPORTED_TOKENS = {
  'scout-protocol-token': 'scout-protocol-token',
  'dev': 'scout-protocol-token',
  'bitcoin': 'bitcoin',
  'btc': 'bitcoin',
  'ethereum': 'ethereum',
  'eth': 'ethereum'
} as const;

type SupportedTokenId = keyof typeof SUPPORTED_TOKENS;

/**
 * Gets the latest token price from the database
 * @param tokenId The token identifier (can be alias like 'dev', 'btc', 'eth' or full ID)
 * @returns The latest price from database or null if not found
 */
export async function getLatestTokenPriceFromDatabase(tokenId: string): Promise<number | null> {
  const normalizedTokenId = tokenId.toLowerCase() as SupportedTokenId;
  const standardizedId = SUPPORTED_TOKENS[normalizedTokenId];
  
  if (!standardizedId) {
    logger.warn(`Unsupported token ID: ${tokenId}`);
    return null;
  }

  try {
    const latestPrice = await getLatestTokenPriceRecord(standardizedId);

    if (latestPrice) {
      logger.info(`[DatabasePrice] Retrieved price for ${standardizedId}: $${latestPrice.price} (timestamp: ${latestPrice.timestamp.toISOString()})`);
      return latestPrice.price;
    } else {
      logger.warn(`No price data found in database for token: ${standardizedId}`);
      return null;
    }
  } catch (error) {
    logger.error("Error fetching token price from database:", error);
    return null;
  }
}

/**
 * Gets the latest token price with metadata from the database
 * @param tokenId The token identifier (can be alias like 'dev', 'btc', 'eth' or full ID)
 * @returns The latest price record with timestamp or null if not found
 */
export async function getLatestTokenPriceWithMetadata(tokenId: string): Promise<{price: number, timestamp: Date} | null> {
  const normalizedTokenId = tokenId.toLowerCase() as SupportedTokenId;
  const standardizedId = SUPPORTED_TOKENS[normalizedTokenId];
  
  if (!standardizedId) {
    logger.warn(`Unsupported token ID: ${tokenId}`);
    return null;
  }

  try {
    // Get the latest price from the database
    const latestPrice = await prisma.tokenPrice.findFirst({
      where: {
        token: {
            id: standardizedId // Use 'id' or the correct field for token ID
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    if (latestPrice) {
      logger.info(`[DatabasePrice] Retrieved price with metadata for ${standardizedId}: $${latestPrice.price} (timestamp: ${latestPrice.timestamp.toISOString()})`);
      return {
        price: latestPrice.price,
        timestamp: latestPrice.timestamp
      };
    } else {
      logger.warn(`No price data found in database for token: ${standardizedId}`);
      return null;
    }
  } catch (error) {
    logger.error("Error fetching token price from database:", error);
    return null;
  }
}
async function getLatestTokenPriceRecord(standardizedId: string): Promise<{ price: number, timestamp: Date } | null> {
    try {
        const record = await prisma.tokenPrice.findFirst({
            where: {
                token: {
                    id: standardizedId // Use 'id' or the correct field for token ID
                }
            },
            orderBy: {
                timestamp: 'desc'
            }
        });

        if (record) {
            return {
                price: record.price,
                timestamp: record.timestamp
            };
        } else {
            return null;
        }
    } catch (error) {
        logger.error("Error in getLatestTokenPriceRecord:", error);
        return null;
    }
}

