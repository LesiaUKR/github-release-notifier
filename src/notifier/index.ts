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

interface NotificationResult {
  total: number;
  sent: number;
  failed: number;
}

export async function sendConfirmationEmail(data: ConfirmationData): Promise<boolean> {
  const confirmUrl = `${config.BASE_URL}/confirm/${data.confirmationToken}`;
  const unsubscribeUrl = `${config.BASE_URL}/unsubscribe/${data.confirmationToken}`;

  const { subject, html } = buildConfirmationEmail({
    owner: data.owner,
    repo: data.repo,
    confirmUrl,
    unsubscribeUrl,
  });

  const sent = await sendEmail(data.email, subject, html);

  if (sent) {
    logger.info(
      `Notifier: confirmation email sent to ${data.email} for ${data.owner}/${data.repo}`
    );
  } else {
    logger.error(
      `Notifier: failed to send confirmation email to ${data.email} for ${data.owner}/${data.repo}`
    );
  }

  return sent;
}

export async function sendReleaseNotifications(
  subscribers: Subscriber[],
  releaseData: Omit<ReleaseEmailData, 'unsubscribeUrl'>
): Promise<NotificationResult> {
  if (subscribers.length === 0) {
    logger.debug('Notifier: no subscribers to notify');
    return { total: 0, sent: 0, failed: 0 };
  }

  logger.info(
    `Notifier: sending ${subscribers.length} emails for ${releaseData.owner}/${releaseData.repo} ${releaseData.tagName}`
  );

  let sent = 0;
  let failed = 0;

  for (const subscriber of subscribers) {
    const unsubscribeUrl = subscriber.confirmationToken
      ? `${config.BASE_URL}/unsubscribe/${subscriber.confirmationToken}`
      : `${config.BASE_URL}`;

    const { subject, html } = buildReleaseEmail({
      ...releaseData,
      unsubscribeUrl,
    });

    const delivered = await sendEmail(subscriber.email, subject, html);

    if (delivered) {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  logger.info(
    `Notifier: finished sending emails for ${releaseData.owner}/${releaseData.repo} ${releaseData.tagName} (${sent}/${subscribers.length} delivered)`
  );

  return {
    total: subscribers.length,
    sent,
    failed,
  };
}
