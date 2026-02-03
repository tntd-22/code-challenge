import { Request, Response } from 'express';
import { asyncHandler } from '../../common/middleware/index.js';
import { orderService } from './order.service.js';
import type { CreateOrderInput, UpdateOrderInput, ListOrdersInput } from './order.schema.js';

export const orderController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const data = req.body as CreateOrderInput;
    const order = await orderService.create(data);
    res.setHeader('Location', `/orders/${order.id}`);
    res.status(201).json(order);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListOrdersInput;
    const result = await orderService.list(query);
    res.json(result);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: number };
    const order = await orderService.getById(id);
    res.json(order);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: number };
    const data = req.body as UpdateOrderInput;
    const order = await orderService.update(id, data);
    res.json(order);
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: number };
    await orderService.delete(id);
    res.status(204).send();
  }),
};
