import { and, eq } from 'drizzle-orm';

import { db } from '../db';
import { subscriptions } from '../db/schema';
import { ConflictError, NotFoundError } from '../errors';
import * as repositoryService from './repositoryService';

export async function createSubscription(email: string, owner: string, repo: string) {
  await repositoryService.validateAndUpsert(owner, repo);

  const existing = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.email, email),
        eq(subscriptions.owner, owner),
        eq(subscriptions.repo, repo)
      )
    );

  if (existing.length > 0) {
    throw new ConflictError('Subscription already exists');
  }

  const [subscription] = await db.insert(subscriptions).values({ email, owner, repo }).returning();

  return subscription;
}

export async function getSubscriptionById(id: string) {
  const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));

  if (!subscription) {
    throw new NotFoundError('Subscription not found');
  }

  return subscription;
}

export async function deleteSubscription(id: string) {
  const [deleted] = await db.delete(subscriptions).where(eq(subscriptions.id, id)).returning();

  if (!deleted) {
    throw new NotFoundError('Subscription not found');
  }
}
