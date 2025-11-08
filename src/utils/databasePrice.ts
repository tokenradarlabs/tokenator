import prisma from "./prisma";
import logger from "./logger";
import { Token, TokenPrice } from "../generated/prisma";

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
    const latestPrice: TokenPrice | null = await getLatestTokenPriceRecord(standardizedId);

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
 * Upserts token price data into the database using a transaction.
 * Ensures that the token exists before creating a price record.
 * @param tokenAddress The unique address of the token.
 * @param price The price of the token.
 * @param timestamp The timestamp of the price data.
 */
export async function upsertTokenPrice(tokenAddress: string, price: number, timestamp: Date): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      // Find or create the token
      const token: Token = await tx.token.upsert({
        where: { address: tokenAddress },
        update: {},
        create: { address: tokenAddress },
      });

      // Create the token price record
      await tx.tokenPrice.create({
        data: {
          price: price,
          timestamp: timestamp,
          tokenId: token.id,
        },
      });
    });
    logger.info(`[DatabasePrice] Successfully upserted price for ${tokenAddress}: ${price} (timestamp: ${timestamp.toISOString()})`);
  } catch (error) {
    logger.error(`Error upserting token price for ${tokenAddress}:`, error);
    throw error; // Re-throw to allow calling function to handle
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
    const latestPrice: TokenPrice | null = await prisma.tokenPrice.findFirst({
      where: {
        token: {
          address: standardizedId 
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
async function getLatestTokenPriceRecord(standardizedId: string): Promise<TokenPrice | null> {
    try {
        const record: TokenPrice | null = await prisma.tokenPrice.findFirst({
            where: {
                token: {
                    address: standardizedId 
                }
            },
            orderBy: {
                timestamp: 'desc'
            }
        });

        if (record) {
            return record;
        } else {
            return null;
        }
    } catch (error) {
        logger.error("Error in getLatestTokenPriceRecord:", error);
        return null;
    }
}

