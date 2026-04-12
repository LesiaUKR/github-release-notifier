import { Request, Response } from 'express';

import { NotFoundError } from '../errors';
import {
  confirmErrorPage,
  confirmSuccessPage,
  unsubscribeErrorPage,
  unsubscribeSuccessPage,
} from '../notifier/templates/pages';
import * as subscriptionService from '../services/subscriptionService';
import { logger } from '../utils/logger';

const GENERIC_CONFIRM_ERROR = 'Something went wrong. Please try again later.';
const GENERIC_UNSUBSCRIBE_ERROR = 'Something went wrong. Please try again later.';

export async function confirm(req: Request<{ token: string }>, res: Response): Promise<void> {
  try {
    const sub = await subscriptionService.confirmSubscription(req.params.token);
    res.send(confirmSuccessPage(sub.owner, sub.repo));
  } catch (error) {
    const message = error instanceof NotFoundError ? error.message : GENERIC_CONFIRM_ERROR;
    const statusCode = error instanceof NotFoundError ? 400 : 500;

    if (!(error instanceof NotFoundError)) {
      logger.error('Confirmation flow failed', error);
    }

    res.status(statusCode).send(confirmErrorPage(message));
  }
}

export async function unsubscribe(req: Request<{ token: string }>, res: Response): Promise<void> {
  try {
    const sub = await subscriptionService.unsubscribeByToken(req.params.token);
    res.send(unsubscribeSuccessPage(sub.owner, sub.repo));
  } catch (error) {
    const message = error instanceof NotFoundError ? error.message : GENERIC_UNSUBSCRIBE_ERROR;
    const statusCode = error instanceof NotFoundError ? 400 : 500;

    if (!(error instanceof NotFoundError)) {
      logger.error('Unsubscribe flow failed', error);
    }

    res.status(statusCode).send(unsubscribeErrorPage(message));
  }
}
