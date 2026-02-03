import { Router } from 'express';
import { validate } from '../../common/middleware/index.js';
import { userController } from './user.controller.js';
import {
  createUserSchema,
  updateUserSchema,
  listUsersSchema,
  idParamSchema,
} from './user.schema.js';

const router = Router();

router.post(
  '/',
  validate(createUserSchema, 'body'),
  userController.create
);

router.get(
  '/',
  validate(listUsersSchema, 'query'),
  userController.list
);

router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  userController.getById
);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateUserSchema, 'body'),
  userController.update
);

router.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  userController.delete
);

export default router;
