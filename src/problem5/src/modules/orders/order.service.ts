import { NotFoundError, ValidationError } from '../../common/errors/index.js';
import { config } from '../../config/index.js';
import { orderRepository, OrderRepository } from './order.repository.js';
import { userRepository, UserRepository } from '../users/user.repository.js';
import { productRepository, ProductRepository } from '../products/product.repository.js';
import type { Order, PaginatedResult } from './order.types.js';
import type { CreateOrderInput, UpdateOrderInput, ListOrdersInput } from './order.schema.js';

export class OrderService {
  constructor(
    private repository: OrderRepository,
    private userRepo: UserRepository,
    private productRepo: ProductRepository,
  ) {}

  async create(data: CreateOrderInput): Promise<Order> {
    // Validate user exists
    const user = await this.userRepo.findById(data.userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Validate products and get prices
    const itemsWithPrices = await Promise.all(
      data.items.map(async (item) => {
        const product = await this.productRepo.findById(item.productId);
        if (!product) {
          throw new NotFoundError(`Product with ID ${item.productId}`);
        }
        if (product.status !== 'active') {
          throw new ValidationError(`Product "${product.name}" is not available for purchase`);
        }
        if (product.stock < item.quantity) {
          throw new ValidationError(`Insufficient stock for product "${product.name}". Available: ${product.stock}`);
        }
        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: product.price,
        };
      })
    );

    // Create order (stock reduction is handled atomically within the repository transaction)
    const order = await this.repository.create(data, itemsWithPrices);

    return order;
  }

  async getById(id: number): Promise<Order> {
    const order = await this.repository.findById(id);
    if (!order) {
      throw new NotFoundError('Order');
    }
    return order;
  }

  async list(query: ListOrdersInput): Promise<PaginatedResult<Order>> {
    const result = await this.repository.findAll(query);
    const limit = query.limit ?? config.pagination.defaultLimit;
    const offset = query.offset ?? 0;
    return {
      data: result.data,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: offset + result.data.length < result.total,
      },
    };
  }

  async update(id: number, data: UpdateOrderInput): Promise<Order> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Order');
    }

    // Validate status transitions
    if (data.status) {
      const validTransitions: Record<string, string[]> = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['shipped', 'cancelled'],
        shipped: ['delivered'],
        delivered: [],
        cancelled: [],
      };

      if (!validTransitions[existing.status]?.includes(data.status)) {
        throw new ValidationError(
          `Cannot change order status from "${existing.status}" to "${data.status}"`
        );
      }

      // If cancelling, restore stock
      if (data.status === 'cancelled') {
        await Promise.all(
          existing.items.map((item) =>
            this.productRepo.updateStock(item.productId, item.quantity)
          )
        );
      }
    }

    const order = await this.repository.update(id, data);
    if (!order) {
      throw new NotFoundError('Order');
    }
    return order;
  }

  async delete(id: number): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Order');
    }

    // Only allow deleting pending orders
    if (existing.status !== 'pending') {
      throw new ValidationError('Only pending orders can be deleted');
    }

    // Restore stock
    await Promise.all(
      existing.items.map((item) =>
        this.productRepo.updateStock(item.productId, item.quantity)
      )
    );

    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundError('Order');
    }
  }
}

export const orderService = new OrderService(
  orderRepository,
  userRepository,
  productRepository
);
