import crypto from 'crypto';
import { and, eq } from 'drizzle-orm';

import { db } from '../db';
import { subscriptions } from '../db/schema';
import { ConflictError, NotFoundError } from '../errors';
import * as repositoryService from './repositoryService';

const TOKEN_EXPIRY_HOURS = 24;

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

  const token = crypto.randomUUID();
  const tokenExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  if (existing.length > 0) {
    const sub = existing[0];

    if (sub.status === 'active') {
      throw new ConflictError('Subscription already exists');
    }

    if (sub.status === 'pending' && sub.tokenExpiresAt && sub.tokenExpiresAt > new Date()) {
      throw new ConflictError('Confirmation email already sent. Check your inbox');
    }

    // pending + expired OR inactive → reactivate
    const [updated] = await db
      .update(subscriptions)
      .set({ status: 'pending', confirmationToken: token, tokenExpiresAt })
      .where(eq(subscriptions.id, sub.id))
      .returning();

    return updated;
  }

  const [subscription] = await db
    .insert(subscriptions)
    .values({ email, owner, repo, status: 'pending', confirmationToken: token, tokenExpiresAt })
    .returning();

  return subscription;
}

export async function confirmSubscription(token: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.confirmationToken, token));

  if (!sub) {
    throw new NotFoundError('Invalid confirmation link');
  }

  if (sub.status === 'active') {
    return sub;
  }

  if (sub.status === 'inactive') {
    throw new NotFoundError('Subscription has been cancelled');
  }

  if (sub.tokenExpiresAt && sub.tokenExpiresAt < new Date()) {
    throw new NotFoundError('Confirmation link has expired');
  }

  const [updated] = await db
    .update(subscriptions)
    .set({ status: 'active', tokenExpiresAt: null })
    .where(eq(subscriptions.id, sub.id))
    .returning();

  return updated;
}

export async function unsubscribeByToken(token: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.confirmationToken, token));

  if (!sub) {
    throw new NotFoundError('Invalid unsubscribe link');
  }

  const [updated] = await db
    .update(subscriptions)
    .set({ status: 'inactive' })
    .where(eq(subscriptions.id, sub.id))
    .returning();

  return updated;
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

export async function getByOwnerRepo(owner: string, repo: string) {
  return db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.owner, owner),
        eq(subscriptions.repo, repo),
        eq(subscriptions.status, 'active')
      )
    );
}
