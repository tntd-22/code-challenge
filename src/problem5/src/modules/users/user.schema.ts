import { z } from 'zod/v4';
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { config } from '../../config/index.js';
import { users } from '../../db/schema/users.js';

export const createUserSchema = createInsertSchema(users, {
  email: (schema) => schema.email('Invalid email address'),
  name: (schema) => schema.min(1, 'Name is required'),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateUserSchema = createUpdateSchema(users, {
  email: (schema) => schema.email('Invalid email address'),
}).omit({ id: true, createdAt: true, updatedAt: true })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const listUsersSchema = z.object({
  email: z.string().optional(),
  role: z.enum(['customer', 'admin']).optional(),
  sortBy: z.enum(['name', 'email', 'createdAt']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  limit: z.coerce.number().int().min(1).max(config.pagination.maxLimit).optional().default(config.pagination.defaultLimit),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid ID'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
