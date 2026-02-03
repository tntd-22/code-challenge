import { Request, Response } from 'express';
import { asyncHandler } from '../../common/middleware/index.js';
import { userService } from './user.service.js';
import type { CreateUserInput, UpdateUserInput, ListUsersInput } from './user.schema.js';

export const userController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const data = req.body as CreateUserInput;
    const user = await userService.create(data);
    res.setHeader('Location', `/users/${user.id}`);
    res.status(201).json(user);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListUsersInput;
    const result = await userService.list(query);
    res.json(result);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: number };
    const user = await userService.getById(id);
    res.json(user);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: number };
    const data = req.body as UpdateUserInput;
    const user = await userService.update(id, data);
    res.json(user);
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: number };
    await userService.delete(id);
    res.status(204).send();
  }),
};
