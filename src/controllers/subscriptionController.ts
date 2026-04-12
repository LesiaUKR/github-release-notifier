import { Request, Response } from 'express';

import { AppError } from '../errors';
import { sendConfirmationEmail } from '../notifier';
import * as subscriptionService from '../services/subscriptionService';

export async function create(req: Request, res: Response): Promise<void> {
  const { email, repo } = req.body;
  const [owner, repoName] = repo.split('/');

  const subscription = await subscriptionService.createSubscription(email, owner, repoName);

  if (!subscription.confirmationToken) {
    throw new AppError('Failed to create confirmation token', 500);
  }

  const sent = await sendConfirmationEmail({
    email: subscription.email,
    owner: subscription.owner,
    repo: subscription.repo,
    confirmationToken: subscription.confirmationToken,
  });

  if (!sent) {
    await subscriptionService.deactivatePendingSubscription(subscription.id);
    throw new AppError('Failed to send confirmation email. Please try again later.', 503);
  }

  res.status(201).json(subscription);
}

export async function getById(req: Request<{ id: string }>, res: Response): Promise<void> {
  const subscription = await subscriptionService.getSubscriptionById(req.params.id);

  res.json(subscription);
}

export async function remove(req: Request<{ id: string }>, res: Response): Promise<void> {
  await subscriptionService.deleteSubscription(req.params.id);

  res.status(204).end();
}
