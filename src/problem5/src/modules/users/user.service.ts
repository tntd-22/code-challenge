import { NotFoundError, ConflictError } from '../../common/errors/index.js';
import { userRepository, UserRepository } from './user.repository.js';
import type { User, PaginatedResult } from './user.types.js';
import type { CreateUserInput, UpdateUserInput, ListUsersInput } from './user.schema.js';

export class UserService {
  constructor(private repository: UserRepository) {}

  async create(data: CreateUserInput): Promise<User> {
    // Check for duplicate email
    const existing = await this.repository.findByEmail(data.email);
    if (existing) {
      throw new ConflictError('User with this email already exists');
    }
    return this.repository.create(data);
  }

  async getById(id: number): Promise<User> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new NotFoundError('User');
    }
    return user;
  }

  async list(query: ListUsersInput): Promise<PaginatedResult<User>> {
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

  async update(id: number, data: UpdateUserInput): Promise<User> {
    // Check for duplicate email if email is being updated
    if (data.email) {
      const existing = await this.repository.findByEmail(data.email);
      if (existing && existing.id !== id) {
        throw new ConflictError('User with this email already exists');
      }
    }

    const user = await this.repository.update(id, data);
    if (!user) {
      throw new NotFoundError('User');
    }
    return user;
  }

  async delete(id: number): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundError('User');
    }
  }
}

export const userService = new UserService(userRepository);
