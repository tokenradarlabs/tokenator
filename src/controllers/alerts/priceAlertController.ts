import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { NotFoundError, BadRequestError, InternalServerError } from '../../utils/httpErrors';
import { validatePriceAlertValue } from '../../utils/priceValidation';
import { CreatePriceAlertSchema, UpdatePriceAlertSchema, CreatePriceAlertInput, UpdatePriceAlertInput } from '../../utils/schemas/priceAlertSchemas';
import logger from '../../utils/logger';

export async function priceAlertController(fastify: FastifyInstance) {

  // Route to create a new price alert
  fastify.post<{ Body: CreatePriceAlertInput }>('/alerts/price', async (request, reply) => {
    try {
      const parsedBody = CreatePriceAlertSchema.safeParse(request.body);

      if (!parsedBody.success) {
        logger.warn('[PriceAlertController] Create price alert validation error:', parsedBody.error.errors);
        throw new BadRequestError(parsedBody.error.errors.map(e => e.message).join(', '));
      }

      const { token, price, direction, userId, triggerOnce } = parsedBody.data;

      // Validate the price alert value using business logic
      const validationResult = await validatePriceAlertValue(token, price, direction);

      if (!validationResult.isValid) {
        throw new BadRequestError(validationResult.errorMessage || 'Invalid price alert parameters.');
      }

      // Placeholder for creating the alert in the database
      // In a real application, you would interact with your Prisma client or ORM here
      logger.info(`[PriceAlertController] Creating price alert for token: ${token}, price: ${price}, direction: ${direction}, userId: ${userId}, triggerOnce: ${triggerOnce}`);

      reply.status(201).send({ message: 'Price alert created successfully (placeholder).' });

    } catch (error) {
      if (error instanceof BadRequestError || error instanceof NotFoundError) {
        throw error;
      } else {
        logger.error('[PriceAlertController] Error creating price alert:', error);
        throw new InternalServerError('Failed to create price alert.');
      }
    }
  });

  // Route to update an existing price alert
  fastify.put<{ Params: { alertId: string }, Body: UpdatePriceAlertInput }>('/alerts/price/:alertId', async (request, reply) => {
    try {
      const { alertId } = request.params;
      const parsedBody = UpdatePriceAlertSchema.safeParse(request.body);

      if (!parsedBody.success) {
        logger.warn('[PriceAlertController] Update price alert validation error:', parsedBody.error.errors);
        throw new BadRequestError(parsedBody.error.errors.map(e => e.message).join(', '));
      }

      const { token, price, direction, triggerOnce } = parsedBody.data;

      // In a real application, you would fetch the existing alert first
      // For now, we'll assume the alert exists and has a token and direction for validation
      const existingAlert = { token: token || 'bitcoin', direction: direction || 'up' }; // Placeholder existing alert

      if (token && price && direction) {
        const validationResult = await validatePriceAlertValue(token, price, direction);
        if (!validationResult.isValid) {
          throw new BadRequestError(validationResult.errorMessage || 'Invalid price alert parameters.');
        }
      } else if (token && price && !direction) {
        // If only token and price are updated, use existing direction for validation
        const validationResult = await validatePriceAlertValue(token, price, existingAlert.direction as 'up' | 'down');
        if (!validationResult.isValid) {
          throw new BadRequestError(validationResult.errorMessage || 'Invalid price alert parameters.');
        }
      } else if (!token && price && direction) {
        // If only price and direction are updated, use existing token for validation
        const validationResult = await validatePriceAlertValue(existingAlert.token, price, direction);
        if (!validationResult.isValid) {
          throw new BadRequestError(validationResult.errorMessage || 'Invalid price alert parameters.');
        }
      }
      // If only token or direction is updated, or only triggerOnce, no price validation is needed here

      // Placeholder for updating the alert in the database
      logger.info(`[PriceAlertController] Updating price alert ${alertId} with token: ${token}, price: ${price}, direction: ${direction}, triggerOnce: ${triggerOnce}`);

      reply.send({ message: `Price alert ${alertId} updated successfully (placeholder).` });

    } catch (error) {
      if (error instanceof BadRequestError || error instanceof NotFoundError) {
        throw error;
      } else {
        logger.error('[PriceAlertController] Error updating price alert:', error);
        throw new InternalServerError('Failed to update price alert.');
      }
    }
  });
}
