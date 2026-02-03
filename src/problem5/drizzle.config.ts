/// <reference types="node" />
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: ['./src/db/schema/users.ts', './src/db/schema/products.ts', './src/db/schema/orders.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
