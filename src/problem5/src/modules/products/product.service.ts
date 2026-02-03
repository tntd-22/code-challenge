import { NotFoundError } from '../../common/errors/index.js';
import { productRepository, ProductRepository } from './product.repository.js';
import type { Product, PaginatedResult } from './product.types.js';
import type { CreateProductInput, UpdateProductInput, ListProductsInput } from './product.schema.js';

export class ProductService {
  constructor(private repository: ProductRepository) {}

  async create(data: CreateProductInput): Promise<Product> {
    return this.repository.create(data);
  }

  async getById(id: number): Promise<Product> {
    const product = await this.repository.findById(id);
    if (!product) {
      throw new NotFoundError('Product');
    }
    return product;
  }

  async list(query: ListProductsInput): Promise<PaginatedResult<Product>> {
    const result = await this.repository.findAll(query);
    return {
      data: result.data,
      pagination: {
        total: result.total,
        limit: query.limit!,
        offset: query.offset!,
        hasMore: query.offset! + result.data.length < result.total,
      },
    };
  }

  async update(id: number, data: UpdateProductInput): Promise<Product> {
    const product = await this.repository.update(id, data);
    if (!product) {
      throw new NotFoundError('Product');
    }
    return product;
  }

  async delete(id: number): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundError('Product');
    }
  }

  async adjustStock(id: number, quantity: number): Promise<Product> {
    const product = await this.repository.updateStock(id, quantity);
    if (!product) {
      throw new NotFoundError('Product');
    }
    return product;
  }
}

export const productService = new ProductService(productRepository);
