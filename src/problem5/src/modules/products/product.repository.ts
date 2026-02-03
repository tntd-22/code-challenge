import { eq, ilike, desc, asc, count, gte, lte, and, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { db } from '../../db/index.js';
import { products } from '../../db/schema/index.js';
import type * as schema from '../../db/schema/index.js';

type Transaction = NodePgDatabase<typeof schema>;
import type { Product } from './product.types.js';
import type { CreateProductInput, UpdateProductInput, ListProductsInput } from './product.schema.js';

type DbProduct = typeof products.$inferSelect;

function mapToProduct(record: DbProduct): Product {
  return {
    id: record.id,
    name: record.name,
    description: record.description ?? '',
    price: record.price,
    stock: record.stock,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class ProductRepository {
  async create(data: CreateProductInput): Promise<Product> {
    const [record] = await db
      .insert(products)
      .values({
        name: data.name,
        description: data.description ?? '',
        price: data.price,
        stock: data.stock ?? 0,
        status: data.status ?? 'draft',
      })
      .returning();
    return mapToProduct(record);
  }

  async findById(id: number): Promise<Product | undefined> {
    const record = await db.query.products.findFirst({
      where: eq(products.id, id),
    });
    return record ? mapToProduct(record) : undefined;
  }

  async findAll(query: ListProductsInput): Promise<{ data: Product[]; total: number }> {
    const { name, status, minPrice, maxPrice, sortBy, order, limit, offset } = query;

    // Build where conditions
    const conditions = [];
    if (name) conditions.push(ilike(products.name, `%${name}%`));
    if (status) conditions.push(eq(products.status, status));
    if (minPrice) conditions.push(gte(products.price, minPrice));
    if (maxPrice) conditions.push(lte(products.price, maxPrice));

    const whereClause = conditions.length > 0
      ? conditions.length === 1 ? conditions[0] : and(...conditions)
      : undefined;

    const sortColumn = sortBy === 'name' ? products.name
      : sortBy === 'price' ? products.price
      : products.createdAt;
    const orderFn = order === 'asc' ? asc : desc;

    const [countResult, records] = await Promise.all([
      db.select({ count: count() }).from(products).where(whereClause),
      db.query.products.findMany({
        where: whereClause,
        orderBy: orderFn(sortColumn),
        limit,
        offset,
      }),
    ]);

    return {
      data: records.map(mapToProduct),
      total: countResult[0]?.count ?? 0,
    };
  }

  async update(id: number, data: UpdateProductInput): Promise<Product | undefined> {
    return await db.transaction(async (tx) => {
      const existing = await tx.query.products.findFirst({
        where: eq(products.id, id),
      });

      if (!existing) return undefined;

      const [record] = await tx
        .update(products)
        .set({
          name: data.name ?? existing.name,
          description: data.description ?? existing.description,
          price: data.price ?? existing.price,
          stock: data.stock ?? existing.stock,
          status: data.status ?? existing.status,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id))
        .returning();

      return record ? mapToProduct(record) : undefined;
    });
  }

  async delete(id: number): Promise<boolean> {
    const result = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning({ id: products.id });
    return result.length > 0;
  }

  async updateStock(id: number, quantity: number): Promise<Product | undefined> {
    return await db.transaction(async (tx) => {
      return this.updateStockInTx(tx, id, quantity);
    });
  }

  /**
   * Update stock within an existing transaction context.
   * Uses SELECT FOR UPDATE to prevent race conditions.
   */
  async updateStockInTx(tx: Transaction, id: number, quantity: number): Promise<Product | undefined> {
    // Use SELECT FOR UPDATE to lock the row and prevent concurrent modifications
    const [existing] = await tx
      .select()
      .from(products)
      .where(eq(products.id, id))
      .for('update');

    if (!existing) return undefined;

    const newStock = existing.stock + quantity;
    if (newStock < 0) {
      throw new Error(`Insufficient stock for product ${id}. Available: ${existing.stock}, requested: ${Math.abs(quantity)}`);
    }

    const [record] = await tx
      .update(products)
      .set({
        stock: newStock,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    return record ? mapToProduct(record) : undefined;
  }
}

export const productRepository = new ProductRepository();
