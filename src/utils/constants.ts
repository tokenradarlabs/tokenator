// Token ID mappings for consistent identification across commands and database
export const TOKEN_ALIASES: { [key: string]: string } = {
  scout: "scout-protocol-token",
  devtoken: "scout-protocol-token",
  btc: "bitcoin",
  eth: "ethereum",
};

export const SUPPORTED_TOKENS = {
  "scout-protocol-token": "scout-protocol-token",
  bitcoin: "bitcoin",
  ethereum: "ethereum",
} as const;

export type SupportedTokenId = keyof typeof SUPPORTED_TOKENS;

/**
 * Resolves a token alias or returns the standardized token ID.
 * @param userInput The token ID or alias provided by the user.
 * @returns The standardized token ID or null if not supported.
 */
export function resolveTokenAlias(userInput: string): string | null {
  const normalizedInput = userInput.toLowerCase();
  const aliasedToken = TOKEN_ALIASES[normalizedInput];

  if (aliasedToken) {
    return SUPPORTED_TOKENS[aliasedToken as SupportedTokenId] || null;
  }

  return SUPPORTED_TOKENS[normalizedInput as SupportedTokenId] || null;
}

/**
 * Checks if a token ID is supported (after alias resolution)
 * @param tokenId The token ID to check
 * @returns True if the token is supported, false otherwise
 */
export function isSupportedToken(tokenId: string): boolean {
  return resolveTokenAlias(tokenId) !== null;
}

// Standardized token IDs for database operations
export const STANDARD_TOKEN_IDS = {
  DEV: "scout-protocol-token",
  BTC: "bitcoin",
  ETH: "ethereum",
} as const;

// CoinGecko API Constants

