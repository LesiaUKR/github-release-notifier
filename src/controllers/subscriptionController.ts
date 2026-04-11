import { Request, Response } from 'express';

import { sendConfirmationEmail } from '../notifier';
import * as subscriptionService from '../services/subscriptionService';
import { logger } from '../utils/logger';

export async function create(req: Request, res: Response): Promise<void> {
  const { email, repo } = req.body;
  const [owner, repoName] = repo.split('/');

  const subscription = await subscriptionService.createSubscription(email, owner, repoName);

  if (subscription.confirmationToken) {
    sendConfirmationEmail({
      email: subscription.email,
      owner: subscription.owner,
      repo: subscription.repo,
      confirmationToken: subscription.confirmationToken,
    }).catch(error => {
      logger.error('Failed to send confirmation email:', error);
    });
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
