import { z } from 'zod/v4';
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { config } from '../../config/index.js';
import { orders, orderItems } from '../../db/schema/orders.js';

const orderItemInputSchema = createInsertSchema(orderItems, {
  quantity: (schema) => schema.min(1, 'Quantity must be at least 1'),
}).omit({ id: true, orderId: true, unitPrice: true });

const baseOrderInsertSchema = createInsertSchema(orders, {
  shippingAddress: (schema) => schema.min(10, 'Shipping address is required').max(500),
}).omit({ id: true, totalAmount: true, createdAt: true, updatedAt: true });

export const createOrderSchema = baseOrderInsertSchema.extend({
  items: z.array(orderItemInputSchema).min(1, 'At least one item is required'),
});

export const updateOrderSchema = createUpdateSchema(orders, {
  shippingAddress: (schema) => schema.min(10).max(500),
}).omit({ id: true, userId: true, totalAmount: true, createdAt: true, updatedAt: true })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const listOrdersSchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']).optional(),
  sortBy: z.enum(['createdAt', 'totalAmount']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  limit: z.coerce.number().int().min(1).max(config.pagination.maxLimit).optional().default(config.pagination.defaultLimit),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid ID'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type ListOrdersInput = z.infer<typeof listOrdersSchema>;
