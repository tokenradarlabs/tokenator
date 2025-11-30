import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { NotFoundError, BadRequestError, InternalServerError } from '../../utils/httpErrors';
import { validatePriceAlertValue } from '../../utils/priceValidation';
import { CreatePriceAlertSchema, UpdatePriceAlertSchema, AlertParamsSchema, CreatePriceAlertInput, UpdatePriceAlertInput } from '../../utils/schemas/priceAlertSchemas';
import { z } from 'zod';

export async function priceAlertController(fastify: FastifyInstance) {

  // Route to create a new price alert
  fastify.post<{ Body: CreatePriceAlertInput }>('/alerts/price', async (request, reply) => {
    try {
      const parsedBody = CreatePriceAlertSchema.safeParse(request.body);

      if (!parsedBody.success) {
        request.log.warn({ errors: parsedBody.error.errors }, '[PriceAlertController] Create price alert validation error');
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
      request.log.info({ token, price, direction, userId, triggerOnce }, `[PriceAlertController] Creating price alert for token: ${token}`);

      reply.status(201).send({ message: 'Price alert created successfully (placeholder).' });

    } catch (error) {
      if (error instanceof BadRequestError || error instanceof NotFoundError) {
        throw error;
      } else {
        request.log.error({ error }, '[PriceAlertController] Error creating price alert');
        throw new InternalServerError('Failed to create price alert.');
      }
    }
  });

  // Route to update an existing price alert
  fastify.put<{ Params: z.infer<typeof AlertParamsSchema>, Body: UpdatePriceAlertInput }>('/alerts/price/:alertId', async (request, reply) => {
    try {
      const { alertId } = request.params;
      const parsedBody = UpdatePriceAlertSchema.safeParse(request.body);

      if (!parsedBody.success) {
        request.log.warn({ errors: parsedBody.error.errors }, '[PriceAlertController] Update price alert validation error');
        throw new BadRequestError(parsedBody.error.errors.map(e => e.message).join(', '));
      }

      const { token, price, direction, triggerOnce } = parsedBody.data;

      // In a real application, you would fetch the existing alert first
      // For now, we'll assume the alert exists and has a token and direction for validation
      // and use sensible defaults if not found or incomplete.
      const existingAlert = { token: 'bitcoin', direction: 'up' }; // Placeholder existing alert

      if (price !== undefined) {
        const effectiveToken = token || existingAlert.token;
        const effectiveDirection = direction || existingAlert.direction;

        const validationResult = await validatePriceAlertValue(effectiveToken, price, effectiveDirection as 'up' | 'down');
        if (!validationResult.isValid) {
          throw new BadRequestError(validationResult.errorMessage || 'Invalid price alert parameters.');
        }
      }

      // Placeholder for updating the alert in the database
      request.log.info({ alertId, token, price, direction, triggerOnce }, `[PriceAlertController] Updating price alert ${alertId}`);

      reply.send({ message: `Price alert ${alertId} updated successfully (placeholder).` });

    } catch (error) {
      if (error instanceof BadRequestError || error instanceof NotFoundError) {
        throw error;
      } else {
        request.log.error({ error }, '[PriceAlertController] Error updating price alert');
        throw new InternalServerError('Failed to update price alert.');
      }
    }
  });
}
