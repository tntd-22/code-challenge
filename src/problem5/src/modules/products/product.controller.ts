import { Request, Response } from 'express';
import { asyncHandler } from '../../common/middleware/index.js';
import { productService } from './product.service.js';
import type { CreateProductInput, UpdateProductInput, ListProductsInput } from './product.schema.js';

export const productController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const data = req.body as CreateProductInput;
    const product = await productService.create(data);
    res.setHeader('Location', `/products/${product.id}`);
    res.status(201).json(product);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListProductsInput;
    const result = await productService.list(query);
    res.json(result);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: number };
    const product = await productService.getById(id);
    res.json(product);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: number };
    const data = req.body as UpdateProductInput;
    const product = await productService.update(id, data);
    res.json(product);
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: number };
    await productService.delete(id);
    res.status(204).send();
  }),
};
