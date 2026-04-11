import { config } from '../config';
import { logger } from '../utils/logger';
import { sendEmail } from './emailSender';
import { buildConfirmationEmail } from './templates/confirmationEmail';
import type { ReleaseEmailData } from './templates/releaseNotification';
import { buildReleaseEmail } from './templates/releaseNotification';

interface Subscriber {
  email: string;
  confirmationToken: string | null;
}

interface ConfirmationData {
  email: string;
  owner: string;
  repo: string;
  confirmationToken: string;
}

export async function sendConfirmationEmail(data: ConfirmationData): Promise<void> {
  const confirmUrl = `${config.BASE_URL}/confirm/${data.confirmationToken}`;
  const unsubscribeUrl = `${config.BASE_URL}/unsubscribe/${data.confirmationToken}`;

  const { subject, html } = buildConfirmationEmail({
    owner: data.owner,
    repo: data.repo,
    confirmUrl,
    unsubscribeUrl,
  });

  await sendEmail(data.email, subject, html);

  logger.info(`Notifier: confirmation email sent to ${data.email} for ${data.owner}/${data.repo}`);
}

export async function sendReleaseNotifications(
  subscribers: Subscriber[],
  releaseData: Omit<ReleaseEmailData, 'unsubscribeUrl'>
): Promise<void> {
  if (subscribers.length === 0) {
    logger.debug('Notifier: no subscribers to notify');
    return;
  }

  logger.info(
    `Notifier: sending ${subscribers.length} emails for ${releaseData.owner}/${releaseData.repo} ${releaseData.tagName}`
  );

  for (const subscriber of subscribers) {
    const unsubscribeUrl = subscriber.confirmationToken
      ? `${config.BASE_URL}/unsubscribe/${subscriber.confirmationToken}`
      : `${config.BASE_URL}`;

    const { subject, html } = buildReleaseEmail({
      ...releaseData,
      unsubscribeUrl,
    });

    await sendEmail(subscriber.email, subject, html);
  }

  logger.info(
    `Notifier: finished sending emails for ${releaseData.owner}/${releaseData.repo} ${releaseData.tagName}`
  );
}
