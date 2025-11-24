import { FastifyInstance } from 'fastify';
import { priceAlertController } from './priceAlertController';
import { validatePriceAlertValue } from '../../utils/priceValidation';
import { BadRequestError, NotFoundError, InternalServerError } from '../../utils/httpErrors';
import logger from '../../utils/logger';

// Mock external dependencies
jest.mock('../../utils/priceValidation', () => ({
  validatePriceAlertValue: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('priceAlertController', () => {
  let fastify: FastifyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    fastify = {
      post: jest.fn(),
      put: jest.fn(),
      // Mock register if needed, but for controller tests, we usually test the routes directly
    } as unknown as FastifyInstance;
  });

  it('should register the priceAlertController plugin', async () => {
    await priceAlertController(fastify);
    expect(fastify.post).toHaveBeenCalledWith('/alerts/price', expect.any(Function));
    expect(fastify.put).toHaveBeenCalledWith('/alerts/price/:alertId', expect.any(Function));
  });

  describe('POST /alerts/price', () => {
    let handler: Function;

    beforeEach(async () => {
      await priceAlertController(fastify);
      handler = (fastify.post as jest.Mock).mock.calls[0][1];
    });

    it('should create a price alert successfully with valid input', async () => {
      (validatePriceAlertValue as jest.Mock).mockResolvedValue({ isValid: true, parsedPriceValue: 110 });

      const request: any = {
        body: {
          token: 'bitcoin',
          price: 50000,
          direction: 'up',
          userId: 'user123',
          triggerOnce: false,
        },
      };
      const reply: any = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await handler(request, reply);

      expect(validatePriceAlertValue).toHaveBeenCalledWith('bitcoin', 50000, 'up');
      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith({ message: 'Price alert created successfully (placeholder).' });
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Creating price alert'));
    });

    it('should return 400 for invalid schema input', async () => {
      const request: any = {
        body: {
          token: '',
          price: -100,
          direction: 'sideways',
          userId: '',
        },
      };
      const reply: any = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await expect(handler(request, reply)).rejects.toThrow(BadRequestError);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Create price alert validation error'), expect.any(Array));
    });

    it('should return 400 if validatePriceAlertValue returns invalid', async () => {
      (validatePriceAlertValue as jest.Mock).mockResolvedValue({ isValid: false, errorMessage: 'Price too low.' });

      const request: any = {
        body: {
          token: 'bitcoin',
          price: 1,
          direction: 'down',
          userId: 'user123',
        },
      };
      const reply: any = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await expect(handler(request, reply)).rejects.toThrow(BadRequestError);
      expect(validatePriceAlertValue).toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Create price alert validation error'), expect.any(Array));
    });

    it('should handle unexpected errors during creation', async () => {
      (validatePriceAlertValue as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      const request: any = {
        body: {
          token: 'bitcoin',
          price: 50000,
          direction: 'up',
          userId: 'user123',
        },
      };
      const reply: any = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await expect(handler(request, reply)).rejects.toThrow(InternalServerError);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error creating price alert'), expect.any(Error));
    });
  });

  describe('PUT /alerts/price/:alertId', () => {
    let handler: Function;

    beforeEach(async () => {
      await priceAlertController(fastify);
      handler = (fastify.put as jest.Mock).mock.calls[0][1];
    });

    it('should update a price alert successfully with valid partial input', async () => {
      (validatePriceAlertValue as jest.Mock).mockResolvedValue({ isValid: true, parsedPriceValue: 55000 });

      const request: any = {
        params: { alertId: 'alert123' },
        body: {
          price: 55000,
        },
      };
      const reply: any = {
        send: jest.fn(),
      };

      await handler(request, reply);

      // Note: The controller has placeholder logic for existing alert, so validation will be called with default token/direction
      expect(validatePriceAlertValue).toHaveBeenCalledWith('bitcoin', 55000, 'up');
      expect(reply.send).toHaveBeenCalledWith({ message: 'Price alert alert123 updated successfully (placeholder).' });
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Updating price alert'));
    });

    it('should update a price alert successfully with valid full input', async () => {
      (validatePriceAlertValue as jest.Mock).mockResolvedValue({ isValid: true, parsedPriceValue: 3500 });

      const request: any = {
        params: { alertId: 'alert456' },
        body: {
          token: 'ethereum',
          price: 3500,
          direction: 'down',
          triggerOnce: true,
        },
      };
      const reply: any = {
        send: jest.fn(),
      };

      await handler(request, reply);

      expect(validatePriceAlertValue).toHaveBeenCalledWith('ethereum', 3500, 'down');
      expect(reply.send).toHaveBeenCalledWith({ message: 'Price alert alert456 updated successfully (placeholder).' });
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Updating price alert'));
    });

    it('should return 400 for invalid schema input', async () => {
      const request: any = {
        params: { alertId: 'alert123' },
        body: {
          price: -100,
          direction: 'invalid',
        },
      };
      const reply: any = {
        send: jest.fn(),
      };

      await expect(handler(request, reply)).rejects.toThrow(BadRequestError);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Update price alert validation error'), expect.any(Array));
    });

    it('should return 400 if validatePriceAlertValue returns invalid during update', async () => {
      (validatePriceAlertValue as jest.Mock).mockResolvedValue({ isValid: false, errorMessage: 'Price too high.' });

      const request: any = {
        params: { alertId: 'alert123' },
        body: {
          token: 'ethereum',
          price: 999999,
          direction: 'up',
        },
      };
      const reply: any = {
        send: jest.fn(),
      };

      await expect(handler(request, reply)).rejects.toThrow(BadRequestError);
      expect(validatePriceAlertValue).toHaveBeenCalled();
    });

    it('should handle unexpected errors during update', async () => {
      (validatePriceAlertValue as jest.Mock).mockRejectedValue(new Error('Network error'));

      const request: any = {
        params: { alertId: 'alert123' },
        body: {
          token: 'bitcoin',
          price: 60000,
          direction: 'up',
        },
      };
      const reply: any = {
        send: jest.fn(),
      };

      await expect(handler(request, reply)).rejects.toThrow(InternalServerError);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error updating price alert'), expect.any(Error));
    });
  });
});
