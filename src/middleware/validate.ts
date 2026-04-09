import { NextFunction, Request, Response } from 'express';
import { z } from 'zod/v4';

import { ValidationError } from '../errors';

type RequestField = 'body' | 'params' | 'query';

export function validate(schema: z.ZodType, field: RequestField = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[field]);

    if (!result.success) {
      const message = z.prettifyError(result.error);
      next(new ValidationError(message));
      return;
    }

    req[field] = result.data;
    next();
  };
}
