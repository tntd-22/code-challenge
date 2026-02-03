import { eq, desc, asc, count, and, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { orders, orderItems, users, products } from '../../db/schema/index.js';
import { productRepository } from '../products/product.repository.js';
import type { Order, OrderItem } from './order.types.js';
import type { CreateOrderInput, UpdateOrderInput, ListOrdersInput } from './order.schema.js';

type DbOrder = typeof orders.$inferSelect;
type DbOrderItem = typeof orderItems.$inferSelect;

function mapToOrderItem(record: DbOrderItem, productName?: string): OrderItem {
  return {
    id: record.id,
    productId: record.productId,
    productName,
    quantity: record.quantity,
    unitPrice: record.unitPrice,
  };
}

function mapToOrder(record: DbOrder, items: OrderItem[], userName?: string): Order {
  return {
    id: record.id,
    userId: record.userId,
    userName,
    status: record.status,
    totalAmount: record.totalAmount,
    shippingAddress: record.shippingAddress,
    items,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class OrderRepository {
  async create(data: CreateOrderInput, itemsWithPrices: { productId: number; quantity: number; unitPrice: string }[]): Promise<Order> {
    return await db.transaction(async (tx) => {
      // Calculate total
      const totalAmount = itemsWithPrices.reduce((sum, item) => {
        return sum + parseFloat(item.unitPrice) * item.quantity;
      }, 0).toFixed(2);

      // Reduce stock for each product WITHIN the transaction
      // This prevents race conditions where two concurrent orders could both pass stock checks
      for (const item of itemsWithPrices) {
        await productRepository.updateStockInTx(tx, item.productId, -item.quantity);
      }

      // Create order
      const [orderRecord] = await tx
        .insert(orders)
        .values({
          userId: data.userId,
          shippingAddress: data.shippingAddress,
          totalAmount,
          status: 'pending',
        })
        .returning();

      // Create order items
      const orderItemRecords = await tx
        .insert(orderItems)
        .values(
          itemsWithPrices.map((item) => ({
            orderId: orderRecord.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          }))
        )
        .returning();

      const items = orderItemRecords.map((item) => mapToOrderItem(item));
      return mapToOrder(orderRecord, items);
    });
  }

  async findById(id: number): Promise<Order | undefined> {
    const orderRecord = await db.query.orders.findFirst({
      where: eq(orders.id, id),
    });

    if (!orderRecord) return undefined;

    // Get order items with product names
    const itemRecords = await db
      .select({
        item: orderItems,
        productName: products.name,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, id));

    // Get user name
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, orderRecord.userId),
    });

    const items = itemRecords.map((r) => mapToOrderItem(r.item, r.productName ?? undefined));
    return mapToOrder(orderRecord, items, userRecord?.name);
  }

  async findAll(query: ListOrdersInput): Promise<{ data: Order[]; total: number }> {
    const { userId, status, sortBy, order, limit, offset } = query;

    // Build where conditions
    const conditions = [];
    if (userId) conditions.push(eq(orders.userId, userId));
    if (status) conditions.push(eq(orders.status, status));

    const whereClause = conditions.length > 0
      ? (conditions.length === 1 ? conditions[0] : and(...conditions))
      : undefined;

    const sortColumn = sortBy === 'totalAmount' ? orders.totalAmount : orders.createdAt;
    const orderFn = order === 'asc' ? asc : desc;

    const [countResult, orderRecords] = await Promise.all([
      db.select({ count: count() }).from(orders).where(whereClause),
      db.query.orders.findMany({
        where: whereClause,
        orderBy: orderFn(sortColumn),
        limit,
        offset,
      }),
    ]);

    if (orderRecords.length === 0) {
      return { data: [], total: countResult[0]?.count ?? 0 };
    }

    // Batch fetch all order items and users to avoid N+1 queries
    const orderIds = orderRecords.map((o) => o.id);
    const userIds = [...new Set(orderRecords.map((o) => o.userId))];

    const [allItems, allUsers] = await Promise.all([
      // Fetch all order items for all orders in one query
      db
        .select({
          item: orderItems,
          productName: products.name,
        })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(inArray(orderItems.orderId, orderIds)),
      // Fetch all users in one query
      db.query.users.findMany({
        where: inArray(users.id, userIds),
      }),
    ]);

    // Build lookup maps for O(1) access
    const itemsByOrderId = new Map<number, OrderItem[]>();
    for (const r of allItems) {
      const orderId = r.item.orderId;
      if (!itemsByOrderId.has(orderId)) {
        itemsByOrderId.set(orderId, []);
      }
      itemsByOrderId.get(orderId)!.push(mapToOrderItem(r.item, r.productName ?? undefined));
    }

    const userNameById = new Map<number, string>();
    for (const u of allUsers) {
      userNameById.set(u.id, u.name);
    }

    // Assemble orders with their items and user names
    const ordersWithDetails = orderRecords.map((orderRecord) => {
      const items = itemsByOrderId.get(orderRecord.id) ?? [];
      const userName = userNameById.get(orderRecord.userId);
      return mapToOrder(orderRecord, items, userName);
    });

    return {
      data: ordersWithDetails,
      total: countResult[0]?.count ?? 0,
    };
  }

  async update(id: number, data: UpdateOrderInput): Promise<Order | undefined> {
    return await db.transaction(async (tx) => {
      const existing = await tx.query.orders.findFirst({
        where: eq(orders.id, id),
      });

      if (!existing) return undefined;

      const [orderRecord] = await tx
        .update(orders)
        .set({
          status: data.status ?? existing.status,
          shippingAddress: data.shippingAddress ?? existing.shippingAddress,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, id))
        .returning();

      // Get items and user for response
      const itemRecords = await tx
        .select({
          item: orderItems,
          productName: products.name,
        })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.orderId, id));

      const userRecord = await tx.query.users.findFirst({
        where: eq(users.id, orderRecord.userId),
      });

      const items = itemRecords.map((r) => mapToOrderItem(r.item, r.productName ?? undefined));
      return mapToOrder(orderRecord, items, userRecord?.name);
    });
  }

  async delete(id: number): Promise<boolean> {
    const result = await db
      .delete(orders)
      .where(eq(orders.id, id))
      .returning({ id: orders.id });
    return result.length > 0;
  }
}

export const orderRepository = new OrderRepository();
