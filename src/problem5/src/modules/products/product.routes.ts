import { Router } from 'express';
import { validate } from '../../common/middleware/index.js';
import { productController } from './product.controller.js';
import {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  idParamSchema,
} from './product.schema.js';

const router = Router();

router.post(
  '/',
  validate(createProductSchema, 'body'),
  productController.create
);

router.get(
  '/',
  validate(listProductsSchema, 'query'),
  productController.list
);

router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  productController.getById
);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateProductSchema, 'body'),
  productController.update
);

router.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  productController.delete
);

export default router;
