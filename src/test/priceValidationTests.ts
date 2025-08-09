/**
 * Test file to demonstrate the price validation functionality
 * This file shows how the validation works with different scenarios
 */

import {
  validatePriceAlertValue,
  getTokenPriceBounds,
} from '../utils/priceValidation';

// Test scenarios for price validation
const testScenarios = [
  // Valid scenarios
  {
    tokenId: 'bitcoin',
    value: 50000,
    direction: 'up' as const,
    expected: 'valid',
  },
  {
    tokenId: 'ethereum',
    value: 3000,
    direction: 'down' as const,
    expected: 'valid',
  },
  { tokenId: 'dev', value: 0.1, direction: 'up' as const, expected: 'valid' },

  // Invalid scenarios - negative values
  {
    tokenId: 'bitcoin',
    value: -100,
    direction: 'up' as const,
    expected: 'invalid - negative',
  },
  {
    tokenId: 'ethereum',
    value: 0,
    direction: 'down' as const,
    expected: 'invalid - zero',
  },

  // Invalid scenarios - out of bounds
  {
    tokenId: 'bitcoin',
    value: 0.5,
    direction: 'up' as const,
    expected: 'invalid - too low',
  },
  {
    tokenId: 'bitcoin',
    value: 15000000,
    direction: 'up' as const,
    expected: 'invalid - too high',
  },
  {
    tokenId: 'dev',
    value: 0.000001,
    direction: 'up' as const,
    expected: 'invalid - too low',
  },
  {
    tokenId: 'dev',
    value: 1000,
    direction: 'up' as const,
    expected: 'invalid - too high',
  },

  // Edge cases
  {
    tokenId: 'unsupported-token',
    value: 100,
    direction: 'up' as const,
    expected: 'invalid - unsupported token',
  },
];

/**
 * Run validation tests
 */
export async function runPriceValidationTests() {
  console.log('🧪 Running Price Validation Tests\n');

  for (const scenario of testScenarios) {
    console.log(
      `Testing: ${scenario.tokenId} @ $${scenario.value} (${scenario.direction})`
    );
    console.log(`Expected: ${scenario.expected}`);

    try {
      const result = await validatePriceAlertValue(
        scenario.tokenId,
        scenario.value,
        scenario.direction
      );

      if (result.isValid) {
        console.log(
          `✅ Valid - Current price: $${result.currentPrice || 'N/A'}`
        );
      } else {
        console.log(`❌ Invalid - ${result.errorMessage}`);
      }
    } catch (error) {
      console.log(`💥 Error - ${error}`);
    }

    console.log('---');
  }

  // Display token bounds
  console.log('\n📊 Token Price Bounds:');
  const tokens = ['bitcoin', 'ethereum', 'dev'];

  for (const token of tokens) {
    const bounds = getTokenPriceBounds(token);
    if (bounds) {
      console.log(
        `${bounds.name}: $${bounds.min} - $${bounds.max.toLocaleString()}`
      );
    }
  }
}

// Example usage:
// import { runPriceValidationTests } from './test/priceValidationTests';
// runPriceValidationTests();
