import { Request, Response, NextFunction } from 'express';
import { z } from 'zod/v4';

type ValidateTarget = 'body' | 'query' | 'params';

export function validate(schema: z.ZodType, target: ValidateTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      next(result.error);
      return;
    }

    req[target] = result.data;
    next();
  };
}
