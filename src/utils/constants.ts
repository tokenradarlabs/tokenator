// Token ID mappings for consistent identification across commands and database
export const SUPPORTED_TOKENS = {
  "scout-protocol-token": "scout-protocol-token",
  dev: "scout-protocol-token",
  bitcoin: "bitcoin",
  btc: "bitcoin",
  ethereum: "ethereum",
  eth: "ethereum",
} as const;

export type SupportedTokenId = keyof typeof SUPPORTED_TOKENS;

/**
 * Gets the standardized token ID from user input
 * @param userInput The token ID provided by the user
 * @returns The standardized token ID or null if not supported
 */
export function getStandardizedTokenId(userInput: string): string | null {
  const normalizedInput = userInput.toLowerCase() as SupportedTokenId;
  return SUPPORTED_TOKENS[normalizedInput] || null;
}

/**
 * Checks if a token ID is supported
 * @param tokenId The token ID to check
 * @returns True if the token is supported, false otherwise
 */
export function isSupportedToken(tokenId: string): boolean {
  return tokenId.toLowerCase() in SUPPORTED_TOKENS;
}

// Standardized token IDs for database operations
export const STANDARD_TOKEN_IDS = {
  DEV: "scout-protocol-token",
  BTC: "bitcoin",
  ETH: "ethereum",
} as const;

// CoinGecko API Constants

