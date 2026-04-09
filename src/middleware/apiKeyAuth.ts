import crypto from 'crypto';
import { and, eq } from 'drizzle-orm';
import { NextFunction, Request, Response } from 'express';

import { db } from '../db';
import { apiKeys } from '../db/schema';
import { ForbiddenError, UnauthorizedError } from '../errors';

const EXCLUDED_PATHS = ['/health', '/metrics', '/api-docs'];

function isExcluded(path: string): boolean {
  return EXCLUDED_PATHS.some(p => path === p || path.startsWith(`${p}/`));
}

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function apiKeyAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (req.method === 'OPTIONS' || isExcluded(req.path)) {
    next();
    return;
  }

  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    throw new UnauthorizedError('Missing X-API-Key header');
  }

  const keyHash = hashApiKey(apiKey);

  const [key] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)));

  if (!key) {
    throw new ForbiddenError('Invalid API key');
  }

  next();
}
