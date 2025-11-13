import {
  _validateNumericInput,
  _checkAbsoluteBounds,
  validatePriceAlertValue,
  getTokenPriceBounds,
  PriceValidationResult,
} from './priceValidation';
import { getLatestTokenPriceFromDatabase } from './databasePrice';
import { fetchTokenPrice } from './coinGecko';
import { getStandardizedTokenId } from './constants';
import { formatPrice } from './priceFormatter';
import logger from './logger';

jest.mock('./databasePrice', () => ({
  getLatestTokenPriceFromDatabase: jest.fn(),
}));
jest.mock('./coinGecko', () => ({
  fetchTokenPrice: jest.fn(),
}));
jest.mock('./constants', () => ({
  getStandardizedTokenId: jest.fn(),
}));
jest.mock('./priceFormatter', () => ({
  formatPrice: jest.fn(),
}));
jest.mock('./logger', () => ({
  warn: jest.fn(),
  info: jest.fn(),
}));

describe('priceValidation', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    getStandardizedTokenId.mockImplementation((id) => {
      if (id === 'dev' || id === 'scout-protocol-token') return 'scout-protocol-token';
      if (id === 'btc' || id === 'bitcoin') return 'bitcoin';
      if (id === 'eth' || id === 'ethereum') return 'ethereum';
      return null;
    });
    formatPrice.mockImplementation((price) => `$${price.toFixed(2)}`);
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
    });

    it('should return isValid: true for a valid price within bounds and realistic deviation (up)', async () => {
      const result = await validatePriceAlertValue('dev', 110, 'up');
      expect(result).toEqual({ isValid: true, parsedPriceValue: 110, currentPrice: mockCurrentPrice });
    });

    it('should return isValid: true for a valid price within bounds and realistic deviation (down)', async () => {
      const result = await validatePriceAlertValue('dev', 90, 'down');
      expect(result).toEqual({ isValid: true, parsedPriceValue: 90, currentPrice: mockCurrentPrice });
    });

    it('should return isValid: false for unsupported token', async () => {
      const result = await validatePriceAlertValue('unsupported-token', 100, 'up');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Unsupported token');
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
      expect(getLatestTokenPriceFromDatabase).toHaveBeenCalledWith('dev');
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
      getStandardizedTokenId.mockReturnValue(null);
      const bounds = getTokenPriceBounds('unknown');
      expect(bounds).toBeNull();
    });
  });
});
