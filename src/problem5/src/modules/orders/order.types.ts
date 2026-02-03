export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: number;
  productId: number;
  productName?: string;
  quantity: number;
  unitPrice: string;
}

export interface Order {
  id: number;
  userId: number;
  userName?: string;
  status: OrderStatus;
  totalAmount: string;
  shippingAddress: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderItemDTO {
  productId: number;
  quantity: number;
}

export interface CreateOrderDTO {
  userId: number;
  shippingAddress: string;
  items: CreateOrderItemDTO[];
}

export interface UpdateOrderDTO {
  status?: OrderStatus;
  shippingAddress?: string;
}

export interface ListOrdersQuery {
  userId?: number;
  status?: OrderStatus;
  sortBy?: 'createdAt' | 'totalAmount';
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
