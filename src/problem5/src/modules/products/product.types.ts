export type ProductStatus = 'draft' | 'active' | 'archived';

export interface Product {
  id: number;
  name: string;
  description: string;
  price: string; // Decimal as string to preserve precision
  stock: number;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDTO {
  name: string;
  description?: string;
  price: string;
  stock?: number;
  status?: ProductStatus;
}

export interface UpdateProductDTO {
  name?: string;
  description?: string;
  price?: string;
  stock?: number;
  status?: ProductStatus;
}

export interface ListProductsQuery {
  name?: string;
  status?: ProductStatus;
  minPrice?: string;
  maxPrice?: string;
  sortBy?: 'name' | 'price' | 'createdAt';
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
