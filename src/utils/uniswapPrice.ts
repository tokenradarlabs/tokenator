import { Address, createPublicClient, http, parseAbiItem } from "viem";
import { base } from "viem/chains";

import logger from "./logger";

// Pool and token addresses
const DEV_WETH_POOL_ADDRESS_BASE: Address =
  "0xbC9dF7F489B3D5D38DA7c5a6f7D751Bdaa88f254";
const DEV_ADDRESS_BASE: Address = "0x047157cffb8841a64db93fd4e29fa3796b78466c";
const WETH_ADDRESS_BASE: Address = "0x4200000000000000000000000000000000000006";
const USDC_ADDRESS_BASE: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Token configurations
const USDC: TokenConfig = {
  address: USDC_ADDRESS_BASE,
  decimals: 6,
};

const WETH: TokenConfig = {
  address: WETH_ADDRESS_BASE,
  decimals: 18,
};

const DEV: TokenConfig = {
  address: DEV_ADDRESS_BASE,
  decimals: 18,
};

// Minimal ABI for Uniswap V3 Pool state
const uniswapV3PoolAbi = [
  parseAbiItem(
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
  ),
  parseAbiItem("function token0() external view returns (address)"),
  parseAbiItem("function token1() external view returns (address)"),
];

interface TokenConfig {
  address: Address;
  decimals: number;
}

/**
 * Generic function to get token price from Uniswap V3 pool
 */
async function getTokenPriceFromV3Pool(
  poolAddress: Address,
  baseToken: TokenConfig,
  quoteToken: TokenConfig
): Promise<number> {
  const BASE_RPC_URL = `https://rpc.ankr.com/base/${process.env.ANKR_API_KEY}`;

  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });

  try {
    const [slot0Result, token0Address, token1Address] = await Promise.all([
      publicClient.readContract({
        address: poolAddress,
        abi: uniswapV3PoolAbi,
        functionName: "slot0",
      }),
      publicClient.readContract({
        address: poolAddress,
        abi: uniswapV3PoolAbi,
        functionName: "token0",
      }),
      publicClient.readContract({
        address: poolAddress,
        abi: uniswapV3PoolAbi,
        functionName: "token1",
      }),
    ]);

    const sqrtPriceX96 = slot0Result[0];

    const isQuoteToken0 =
      token0Address.toLowerCase() === quoteToken.address.toLowerCase();
    const isBaseToken0 =
      token0Address.toLowerCase() === baseToken.address.toLowerCase();

    if (
      !((isQuoteToken0 && !isBaseToken0) || (!isQuoteToken0 && isBaseToken0))
    ) {
      throw new Error(
        `Pool tokens (${token0Address}, ${token1Address}) do not match expected base/quote addresses.`
      );
    }

    const SCALE = 36n;
    const Q96 = 2n ** 96n;
    const Q192 = Q96 * Q96;

    const sqrtP_squared = sqrtPriceX96 * sqrtPriceX96;
    const priceToken1PerToken0_scaled = (sqrtP_squared * 10n ** SCALE) / Q192;

    let baseQuotePrice: number;

    if (isQuoteToken0) {
      const basePerQuote_scaled =
        (priceToken1PerToken0_scaled * 10n ** BigInt(quoteToken.decimals)) /
        10n ** BigInt(baseToken.decimals);

      baseQuotePrice = 1 / (Number(basePerQuote_scaled) / 10 ** Number(SCALE));
    } else {
      const quotePerBase_scaled =
        (priceToken1PerToken0_scaled * 10n ** BigInt(baseToken.decimals)) /
        10n ** BigInt(quoteToken.decimals);

      baseQuotePrice = Number(quotePerBase_scaled) / 10 ** Number(SCALE);
    }

    return baseQuotePrice;
  } catch (error) {
    logger.error("Error fetching price from V3 pool", error as Error, {
      poolAddress,
      baseToken: baseToken.address,
      quoteToken: quoteToken.address,
    });
    return 0;
  }
}

/**
 * Get the price of any token in terms of USDC
 */
export async function getTokenPrice(
  poolAddress: Address,
  token: TokenConfig
): Promise<number> {
  return getTokenPriceFromV3Pool(poolAddress, token, USDC);
}

/**
 * Get the price of ETH in terms of USDC
 */
export async function getEthPrice(): Promise<number> {
  // You'll need to provide the ETH/USDC pool address here
  const ETH_USDC_POOL_ADDRESS: Address =
    "0xd0b53D9277642d899DF5C87A3966A349A798F224";
  return getTokenPrice(ETH_USDC_POOL_ADDRESS, WETH);
}

/**
 * Get the price of DEV token in terms of ETH and convert to USDC
 */
export async function getDevPrice(): Promise<number> {
  try {
    // First get DEV/ETH price
    const devEthPrice = await getTokenPriceFromV3Pool(
      DEV_WETH_POOL_ADDRESS_BASE,
      DEV,
      WETH
    );

    // Then get ETH/USDC price
    const ethUsdcPrice = await getEthPrice();

    // Calculate DEV price in USDC
    return devEthPrice * ethUsdcPrice;
  } catch (error) {
    logger.error("Error fetching DEV price", error as Error);
    return 0;
  }
}
