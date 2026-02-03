import { z } from 'zod/v4';
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { config } from '../../config/index.js';
import { products } from '../../db/schema/products.js';

const priceSchema = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Price must be a valid decimal with up to 2 decimal places');

export const createProductSchema = createInsertSchema(products, {
  name: (schema) => schema.min(1, 'Name is required'),
  description: (schema) => schema.max(2000),
  price: priceSchema,
  stock: z.coerce.number().int().min(0).optional().default(0),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateProductSchema = createUpdateSchema(products, {
  description: (schema) => schema.max(2000),
  price: priceSchema.optional(),
  stock: z.coerce.number().int().min(0).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const listProductsSchema = z.object({
  name: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  minPrice: priceSchema.optional(),
  maxPrice: priceSchema.optional(),
  sortBy: z.enum(['name', 'price', 'createdAt']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  limit: z.coerce.number().int().min(1).max(config.pagination.maxLimit).optional().default(config.pagination.defaultLimit),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid ID'),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsInput = z.infer<typeof listProductsSchema>;
