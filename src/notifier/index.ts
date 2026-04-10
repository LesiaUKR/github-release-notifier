// src/notifier/index.ts

import { logger } from '../utils/logger';
import { sendEmail } from './emailSender';
import type { ReleaseEmailData } from './templates/releaseNotification';
import { buildReleaseEmail } from './templates/releaseNotification';

interface Subscriber {
  email: string;
}

export async function sendReleaseNotifications(
  subscribers: Subscriber[],
  releaseData: ReleaseEmailData
): Promise<void> {
  if (subscribers.length === 0) {
    logger.debug('Notifier: no subscribers to notify');
    return;
  }

  const { subject, html } = buildReleaseEmail(releaseData);

  logger.info(
    `Notifier: sending ${subscribers.length} emails for ${releaseData.owner}/${releaseData.repo} ${releaseData.tagName}`
  );

  for (const subscriber of subscribers) {
    await sendEmail(subscriber.email, subject, html);
  }

  logger.info(
    `Notifier: finished sending emails for ${releaseData.owner}/${releaseData.repo} ${releaseData.tagName}`
  );
}
