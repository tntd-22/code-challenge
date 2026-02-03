import { Router } from 'express';
import { validate } from '../../common/middleware/index.js';
import { orderController } from './order.controller.js';
import {
  createOrderSchema,
  updateOrderSchema,
  listOrdersSchema,
  idParamSchema,
} from './order.schema.js';

const router = Router();

router.post(
  '/',
  validate(createOrderSchema, 'body'),
  orderController.create
);

router.get(
  '/',
  validate(listOrdersSchema, 'query'),
  orderController.list
);

router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  orderController.getById
);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateOrderSchema, 'body'),
  orderController.update
);

router.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  orderController.delete
);

export default router;
