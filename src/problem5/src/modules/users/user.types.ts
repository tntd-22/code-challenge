export type UserRole = 'customer' | 'admin';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDTO {
  email: string;
  name: string;
  role?: UserRole;
}

export interface UpdateUserDTO {
  email?: string;
  name?: string;
  role?: UserRole;
}

export interface ListUsersQuery {
  email?: string;
  role?: UserRole;
  sortBy?: 'name' | 'email' | 'createdAt';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
