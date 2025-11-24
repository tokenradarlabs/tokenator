import { z } from 'zod';

export const PriceAlertDirectionSchema = z.enum(['up', 'down'], {
  errorMap: () => ({ message: 'Direction must be either "up" or "down".' }),
});

export const CreatePriceAlertSchema = z.object({
  token: z.string().min(1, 'Token ID is required.'),
  price: z.union([z.number().positive('Price must be a positive number.'), z.string().min(1, 'Price is required and must be a positive number.')]),
  direction: PriceAlertDirectionSchema,
  userId: z.string().min(1, 'User ID is required.'),
  triggerOnce: z.boolean().optional().default(false),
});

export const AlertParamsSchema = z.object({
  alertId: z.string().min(1, 'Alert ID is required.'),
});

export const UpdatePriceAlertSchema = z.object({
  token: z.string().min(1, 'Token ID is required.').optional(),
  price: z.union([z.number().positive('Price must be a positive number.'), z.string().min(1, 'Price is required and must be a positive number.')]).optional(),
  direction: PriceAlertDirectionSchema.optional(),
  triggerOnce: z.boolean().optional(),
});

export type CreatePriceAlertInput = z.infer<typeof CreatePriceAlertSchema>;
export type UpdatePriceAlertInput = z.infer<typeof UpdatePriceAlertSchema>;
