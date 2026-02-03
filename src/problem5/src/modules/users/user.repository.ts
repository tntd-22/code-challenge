import { eq, ilike, desc, asc, count } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/index.js';
import type { User } from './user.types.js';
import type { CreateUserInput, UpdateUserInput, ListUsersInput } from './user.schema.js';

type DbUser = typeof users.$inferSelect;

function mapToUser(record: DbUser): User {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class UserRepository {
  async create(data: CreateUserInput): Promise<User> {
    const [record] = await db
      .insert(users)
      .values({
        email: data.email,
        name: data.name,
        role: data.role,
      })
      .returning();
    return mapToUser(record);
  }

  async findById(id: number): Promise<User | undefined> {
    const record = await db.query.users.findFirst({
      where: eq(users.id, id),
    });
    return record ? mapToUser(record) : undefined;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const record = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    return record ? mapToUser(record) : undefined;
  }

  async findAll(query: ListUsersInput): Promise<{ data: User[]; total: number }> {
    const { email, role, sortBy, order, limit, offset } = query;

    // Build where conditions
    const conditions = [];
    if (email) conditions.push(ilike(users.email, `%${email}%`));
    if (role) conditions.push(eq(users.role, role));

    const whereClause = conditions.length > 0 ? conditions[0] : undefined;

    const sortColumn = sortBy === 'email' ? users.email
      : sortBy === 'name' ? users.name
      : users.createdAt;
    const orderFn = order === 'asc' ? asc : desc;

    const [countResult, records] = await Promise.all([
      db.select({ count: count() }).from(users).where(whereClause),
      db.query.users.findMany({
        where: whereClause,
        orderBy: orderFn(sortColumn),
        limit,
        offset,
      }),
    ]);

    return {
      data: records.map(mapToUser),
      total: countResult[0]?.count ?? 0,
    };
  }

  async update(id: number, data: UpdateUserInput): Promise<User | undefined> {
    return await db.transaction(async (tx) => {
      const existing = await tx.query.users.findFirst({
        where: eq(users.id, id),
      });

      if (!existing) return undefined;

      const [record] = await tx
        .update(users)
        .set({
          email: data.email ?? existing.email,
          name: data.name ?? existing.name,
          role: data.role ?? existing.role,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      return record ? mapToUser(record) : undefined;
    });
  }

  async delete(id: number): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return result.length > 0;
  }
}

export const userRepository = new UserRepository();
