import { Request, Response } from 'express';

import {
  confirmErrorPage,
  confirmSuccessPage,
  unsubscribeErrorPage,
  unsubscribeSuccessPage,
} from '../notifier/templates/pages';
import * as subscriptionService from '../services/subscriptionService';

export async function confirm(req: Request<{ token: string }>, res: Response): Promise<void> {
  try {
    const sub = await subscriptionService.confirmSubscription(req.params.token);
    res.send(confirmSuccessPage(sub.owner, sub.repo));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid confirmation link';
    res.status(400).send(confirmErrorPage(message));
  }
}

export async function unsubscribe(req: Request<{ token: string }>, res: Response): Promise<void> {
  try {
    const sub = await subscriptionService.unsubscribeByToken(req.params.token);
    res.send(unsubscribeSuccessPage(sub.owner, sub.repo));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid unsubscribe link';
    res.status(400).send(unsubscribeErrorPage(message));
  }
}
