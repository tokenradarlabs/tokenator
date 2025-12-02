import { validatePriceAlertValue, _validateNumericInput, _checkAbsoluteBounds, getTokenPriceBounds, sanitizeTokenSymbol } from './priceValidation';
import { resolveTokenAlias, SUPPORTED_TOKENS } from './constants';
import { formatPrice } from './priceFormatter';
import { getLatestTokenPriceFromDatabase, fetchTokenPrice } from './coinGecko';
import { CreatePriceAlertSchema, UpdatePriceAlertSchema } from './schemas/priceAlertSchemas';

// Mock external dependencies
jest.mock('./constants', () => ({
  resolveTokenAlias: jest.fn(),
  SUPPORTED_TOKENS: {
    "scout-protocol-token": "scout-protocol-token",
    bitcoin: "bitcoin",
    ethereum: "ethereum",
  },
}));

jest.mock('./priceFormatter', () => ({
  formatPrice: jest.fn(),
}));

jest.mock('./coinGecko', () => ({
  getLatestTokenPriceFromDatabase: jest.fn(),
  fetchTokenPrice: jest.fn(),
}));

describe('priceValidation', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    resolveTokenAlias.mockImplementation((id) => {
      if (id === 'dev' || id === 'scout-protocol-token') return 'scout-protocol-token';
      if (id === 'btc' || id === 'bitcoin') return 'bitcoin';
      if (id === 'eth' || id === 'ethereum') return 'ethereum';
      return null;
    });
    formatPrice.mockImplementation((price) => `$${price.toFixed(2)}`);
  });

  describe('sanitizeTokenSymbol', () => {
    it('should trim whitespace and convert to lowercase', () => {
      expect(sanitizeTokenSymbol('  ETH  ')).toBe('eth');
      expect(sanitizeTokenSymbol('BTC')).toBe('btc');
      expect(sanitizeTokenSymbol('Scout-Protocol-Token')).toBe('scout-protocol-token');
    });

    it('should return null for empty string or string with only whitespace', () => {
      expect(sanitizeTokenSymbol('')).toBeNull();
      expect(sanitizeTokenSymbol('   ')).toBeNull();
    });

    it('should return null for null or undefined input', () => {
      expect(sanitizeTokenSymbol(null)).toBeNull();
      expect(sanitizeTokenSymbol(undefined)).toBeNull();
    });

    it('should return the same string if already clean', () => {
      expect(sanitizeTokenSymbol('ethereum')).toBe('ethereum');
    });
  });

  describe('_validateNumericInput', () => {
    // Test cases for _validateNumericInput
    it('should return isValid: true for valid numeric string input', () => {
      const result = _validateNumericInput('123.45');
      expect(result).toEqual({ isValid: true, parsedPriceValue: 123.45 });
    });

    it('should return isValid: true for valid numeric input', () => {
      const result = _validateNumericInput(123.45);
      expect(result).toEqual({ isValid: true, parsedPriceValue: 123.45 });
    });

    it('should return isValid: false for NaN input', () => {
      const result = _validateNumericInput(NaN);
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Invalid price value: "NaN"');
    });

    it('should return isValid: false for string "NaN" input', () => {
      const result = _validateNumericInput('NaN');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Invalid price input: "NaN"');
    });

    it('should return isValid: false for Infinity input', () => {
      const result = _validateNumericInput(Infinity);
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('not a finite number');
    });

    it('should return isValid: false for string "Infinity" input', () => {
      const result = _validateNumericInput('Infinity');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('not a finite number');
    });

    it('should return isValid: false for negative number input', () => {
      const result = _validateNumericInput(-10);
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Price value must be positive');
    });

    it('should return isValid: false for zero input', () => {
      const result = _validateNumericInput(0);
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Price value must be positive');
    });

    it('should return isValid: false for non-numeric string input', () => {
      const result = _validateNumericInput('abc');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Invalid price input: "abc"');
    });

    it('should return isValid: false for null input', () => {
      const result = _validateNumericInput(null);
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Price value cannot be empty');
    });

    it('should return isValid: false for undefined input', () => {
      const result = _validateNumericInput(undefined);
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Price value cannot be empty');
    });

    it('should return isValid: false for other types of input', () => {
      const result = _validateNumericInput({}); // Test with an object
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Invalid price input type: "object"');
    });
  });

  describe('_checkAbsoluteBounds', () => {
    const devBounds = { min: 0.00001, max: 100, name: 'DEV' };
    const btcBounds = { min: 1, max: 10000000, name: 'BTC' };

    it('should return isValid: true when price is within bounds', () => {
      const result = _checkAbsoluteBounds('scout-protocol-token', 50, devBounds);
      expect(result).toEqual({ isValid: true });
    });

    it('should return isValid: true when price is at minimum bound', () => {
      const result = _checkAbsoluteBounds('scout-protocol-token', 0.00001, devBounds);
      expect(result).toEqual({ isValid: true });
    });

    it('should return isValid: true when price is at maximum bound', () => {
      const result = _checkAbsoluteBounds('scout-protocol-token', 100, devBounds);
      expect(result).toEqual({ isValid: true });
    });

    it('should return isValid: false when price is below minimum bound', () => {
      const result = _checkAbsoluteBounds('scout-protocol-token', 0.000001, devBounds);
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('too low for DEV');
    });

    it('should return isValid: false when price is above maximum bound', () => {
      const result = _checkAbsoluteBounds('scout-protocol-token', 101, devBounds);
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('too high for DEV');
    });

    it('should handle different token bounds correctly (BTC)', () => {
      const resultLow = _checkAbsoluteBounds('bitcoin', 0.5, btcBounds);
      expect(resultLow.isValid).toBe(false);
      expect(resultLow.errorMessage).toContain('too low for BTC');

      const resultHigh = _checkAbsoluteBounds('bitcoin', 10000001, btcBounds);
      expect(resultHigh.isValid).toBe(false);
      expect(resultHigh.errorMessage).toContain('too high for BTC');

      const resultValid = _checkAbsoluteBounds('bitcoin', 50000, btcBounds);
      expect(resultValid).toEqual({ isValid: true });
    });
  });

  describe('validatePriceAlertValue', () => {
    const mockCurrentPrice = 100;

    beforeEach(() => {
      getLatestTokenPriceFromDatabase.mockResolvedValue(mockCurrentPrice);
      fetchTokenPrice.mockResolvedValue({ usd: mockCurrentPrice });
      // Mock resolveTokenAlias to return standardized ID based on sanitized input
      resolveTokenAlias.mockImplementation((id) => {
        if (id === 'dev' || id === 'scout-protocol-token') return 'scout-protocol-token';
        if (id === 'btc' || id === 'bitcoin') return 'bitcoin';
        if (id === 'eth' || id === 'ethereum') return 'ethereum';
        return null;
      });
    });

    it('should return isValid: true for a valid price within bounds and realistic deviation (up)', async () => {
      const result = await validatePriceAlertValue('dev', 110, 'up');
      expect(result).toEqual({ isValid: true, parsedPriceValue: 110, currentPrice: mockCurrentPrice, sanitizedTokenId: 'scout-protocol-token' });
    });

    it('should return isValid: true for a valid price within bounds and realistic deviation (down)', async () => {
      const result = await validatePriceAlertValue('dev', 90, 'down');
      expect(result).toEqual({ isValid: true, parsedPriceValue: 90, currentPrice: mockCurrentPrice, sanitizedTokenId: 'scout-protocol-token' });
    });

    it('should return isValid: true for a valid price with mixed-case token input', async () => {
      const result = await validatePriceAlertValue('ETH', 3000, 'up');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedTokenId).toBe('ethereum');
    });

    it('should return isValid: true for a valid price with padded token input', async () => {
      const result = await validatePriceAlertValue('  bTc  ', 50000, 'up');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedTokenId).toBe('bitcoin');
    });

    it('should return isValid: false for empty token input', async () => {
      const result = await validatePriceAlertValue('', 100, 'up');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Token symbol cannot be empty');
    });

    it('should return isValid: false for token input with only spaces', async () => {
      const result = await validatePriceAlertValue('   ', 100, 'up');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Token symbol cannot be empty');
    });

    it('should return isValid: false for unsupported token with specific error message', async () => {
      const result = await validatePriceAlertValue('unsupported-token', 100, 'up');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toMatch(/Unsupported token: "unsupported-token". Supported tokens are: "scout-protocol-token", "bitcoin", "ethereum"./);
    });

    it('should return isValid: false for invalid numeric input', async () => {
      const result = await validatePriceAlertValue('dev', 'abc', 'up');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Invalid price input');
    });

    it('should return isValid: false if price is below absolute min bound', async () => {
      const result = await validatePriceAlertValue('dev', 0.0000001, 'up');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('too low for DEV');
    });

    it('should return isValid: false if price is above absolute max bound', async () => {
      const result = await validatePriceAlertValue('dev', 1000, 'up');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('too high for DEV');
    });

    it('should return isValid: false for unrealistic high price deviation', async () => {
      const result = await validatePriceAlertValue('dev', mockCurrentPrice * 15, 'up'); // 15x current price
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('seems unrealistic');
      expect(result.currentPrice).toBe(mockCurrentPrice);
    });

    it('should return isValid: true for unrealistic low price deviation', async () => {
      const result = await validatePriceAlertValue('dev', mockCurrentPrice / 15, 'down'); // 1/15th current price
      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
      expect(result.currentPrice).toBe(mockCurrentPrice);
    });

    it('should return isValid: false for "up" alert when price is not higher than current', async () => {
      const result = await validatePriceAlertValue('dev', mockCurrentPrice, 'up');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('should be higher than current price');
      expect(result.currentPrice).toBe(mockCurrentPrice);
    });

    it('should return isValid: false for "down" alert when price is not lower than current', async () => {
      const result = await validatePriceAlertValue('dev', mockCurrentPrice, 'down');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('should be lower than current price');
      expect(result.currentPrice).toBe(mockCurrentPrice);
    });

    it('should use CoinGecko if database price is null', async () => {
      getLatestTokenPriceFromDatabase.mockResolvedValue(null);
      const result = await validatePriceAlertValue('dev', 110, 'up');
      expect(getLatestTokenPriceFromDatabase).toHaveBeenCalledWith('scout-protocol-token'); // Should use standardized ID
      expect(fetchTokenPrice).toHaveBeenCalledWith('scout-protocol-token');
      expect(result.isValid).toBe(true);
      expect(result.currentPrice).toBe(mockCurrentPrice);
    });

    it('should still validate if current price cannot be fetched', async () => {
      getLatestTokenPriceFromDatabase.mockResolvedValue(null);
      fetchTokenPrice.mockResolvedValue(null); // Simulate CoinGecko failure
      const result = await validatePriceAlertValue('dev', 50, 'up'); // Within absolute bounds, but no current price for deviation check
      expect(result.isValid).toBe(true);
      expect(result.currentPrice).toBeUndefined(); // currentPrice should be undefined if not fetched
    });

    it('should return isValid: true if current price cannot be fetched and price is within absolute bounds', async () => {
      getLatestTokenPriceFromDatabase.mockResolvedValue(null);
      fetchTokenPrice.mockResolvedValue(null);
      const result = await validatePriceAlertValue('dev', 50, 'up');
      expect(result.isValid).toBe(true);
      expect(result.parsedPriceValue).toBe(50);
      expect(result.currentPrice).toBeUndefined();
    });
  });

  describe('getTokenPriceBounds', () => {
    beforeEach(() => {
      // Mock resolveTokenAlias for getTokenPriceBounds tests as well
      resolveTokenAlias.mockImplementation((id) => {
        if (id === 'dev' || id === 'scout-protocol-token') return 'scout-protocol-token';
        if (id === 'btc' || id === 'bitcoin') return 'bitcoin';
        if (id === 'eth' || id === 'ethereum') return 'ethereum';
        return null;
      });
    });

    it('should return correct bounds for a supported token (DEV)', () => {
      const bounds = getTokenPriceBounds('dev');
      expect(bounds).toEqual({ min: 0.00001, max: 100, name: 'DEV' });
    });

    it('should return correct bounds for a supported token (Bitcoin)', () => {
      const bounds = getTokenPriceBounds('bitcoin');
      expect(bounds).toEqual({ min: 1, max: 10000000, name: 'BTC' });
    });

    it('should return null for an unsupported token', () => {
      const bounds = getTokenPriceBounds('unsupported-token');
      expect(bounds).toBeNull();
    });

    it('should return null for a token with no standardized ID', () => {
      resolveTokenAlias.mockReturnValue(null);
      const bounds = getTokenPriceBounds('unknown');
      expect(bounds).toBeNull();
    });

    it('should return null for an empty token symbol', () => {
      const bounds = getTokenPriceBounds(' ');
      expect(bounds).toBeNull();
    });

    it('should return correct bounds for a token with mixed-case input', () => {
      const bounds = getTokenPriceBounds('BTC ');
      expect(bounds).toEqual({ min: 1, max: 10000000, name: 'BTC' });
    });
  });

  describe('PriceAlertSchemas', () => {
    describe('CreatePriceAlertSchema', () => {
      it('should validate a correct payload', () => {
        const payload = {
          token: 'bitcoin',
          price: 50000,
          direction: 'up',
          userId: 'user123',
          triggerOnce: false,
        };
        const result = CreatePriceAlertSchema.safeParse(payload);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(payload);
      });

      it('should validate a correct payload with price as string', () => {
        const payload = {
          token: 'ethereum',
          price: '3000',
          direction: 'down',
          userId: 'user456',
        };
        const result = CreatePriceAlertSchema.safeParse(payload);
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ ...payload, triggerOnce: false }); // triggerOnce defaults to false
      });

      it('should reject payload with missing token', () => {
        const payload = {
          price: 50000,
          direction: 'up',
          userId: 'user123',
        };
        const result = CreatePriceAlertSchema.safeParse(payload);
        expect(result.success).toBe(false);
        expect(result.error?.errors[0].message).toContain('Token ID is required.');
      });

      it('should reject payload with missing price', () => {
        const payload = {
          token: 'bitcoin',
          direction: 'up',
          userId: 'user123',
        };
        const result = CreatePriceAlertSchema.safeParse(payload);
        expect(result.success).toBe(false);
        expect(result.error?.errors[0].message).toContain('Price is required and must be a positive number.');
      });

      it('should reject payload with non-positive price', () => {
        const payload = {
          token: 'bitcoin',
          price: 0,
          direction: 'up',
          userId: 'user123',
        };
        const result = CreatePriceAlertSchema.safeParse(payload);
        expect(result.success).toBe(false);
        expect(result.error?.errors[0].message).toContain('Price must be a positive number.');
      });

      it('should reject payload with invalid direction', () => {
        const payload = {
          token: 'bitcoin',
          price: 50000,
          direction: 'sideways',
          userId: 'user123',
        };
        const result = CreatePriceAlertSchema.safeParse(payload);
        expect(result.success).toBe(false);
        expect(result.error?.errors[0].message).toContain('Direction must be either "up" or "down".');
      });

      it('should reject payload with missing userId', () => {
        const payload = {
          token: 'bitcoin',
          price: 50000,
          direction: 'up',
        };
        const result = CreatePriceAlertSchema.safeParse(payload);
        expect(result.success).toBe(false);
        expect(result.error?.errors[0].message).toContain('User ID is required.');
      });
    });

    describe('UpdatePriceAlertSchema', () => {
      it('should validate a correct partial payload (price only)', () => {
        const payload = {
          alertId: 'alert123',
          price: 55000,
        };
        const result = UpdatePriceAlertSchema.safeParse(payload);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(payload);
      });

      it('should validate a correct partial payload (direction only)', () => {
        const payload = {
          alertId: 'alert123',
          direction: 'down',
        };
        const result = UpdatePriceAlertSchema.safeParse(payload);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(payload);
      });

      it('should validate a correct full payload', () => {
        const payload = {
          alertId: 'alert123',
          token: 'ethereum',
          price: '3500',
          direction: 'up',
          triggerOnce: true,
        };
        const result = UpdatePriceAlertSchema.safeParse(payload);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(payload);
      });

      it('should reject payload with missing alertId', () => {
        const payload = {
          price: 50000,
          direction: 'up',
        };
        const result = UpdatePriceAlertSchema.safeParse(payload);
        expect(result.success).toBe(false);
        expect(result.error?.errors[0].message).toContain('Alert ID is required.');
      });

      it('should reject payload with non-positive price', () => {
        const payload = {
          alertId: 'alert123',
          price: 0,
        };
        const result = UpdatePriceAlertSchema.safeParse(payload);
        expect(result.success).toBe(false);
        expect(result.error?.errors[0].message).toContain('Price must be a positive number.');
      });

      it('should reject payload with invalid direction', () => {
        const payload = {
          alertId: 'alert123',
          direction: 'invalid',
        };
        const result = UpdatePriceAlertSchema.safeParse(payload);
        expect(result.success).toBe(false);
        expect(result.error?.errors[0].message).toContain('Direction must be either "up" or "down".');
      });
    });
  });
});
