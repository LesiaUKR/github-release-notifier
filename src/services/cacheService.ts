import Redis from 'ioredis';

import { config } from '../config';
import { logger } from '../utils/logger';

const redis = config.REDIS_URL ? new Redis(config.REDIS_URL) : null;

if (redis) {
  redis.on('error', err => {
    logger.warn('Redis connection error:', err.message);
  });
}

export async function get<T>(key: string): Promise<T | null> {
  if (!redis) return null;

  try {
    const value = await redis.get(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch (err) {
    logger.warn(`Redis GET failed for key "${key}":`, (err as Error).message);
    return null;
  }
}

export async function set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!redis) return;

  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn(`Redis SET failed for key "${key}":`, (err as Error).message);
  }
}
