import { NextFunction, Request, Response } from 'express';

import { httpRequestDuration, httpRequestsTotal } from '../utils/metrics';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    const route = req.route ? req.baseUrl + (req.route.path as string) : 'unknown';
    const method = req.method;
    const statusCode = String(res.statusCode);

    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    end({ method, route });
  });

  next();
}
