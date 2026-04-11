import { escapeHtml } from './helpers';

interface ConfirmationEmailData {
  owner: string;
  repo: string;
  confirmUrl: string;
  unsubscribeUrl: string;
}

interface EmailContent {
  subject: string;
  html: string;
}

export function buildConfirmationEmail(data: ConfirmationEmailData): EmailContent {
  const repoFullName = `${data.owner}/${data.repo}`;

  const subject = `Confirm your subscription to ${repoFullName}`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 16px;">Confirm your subscription</h2>
      <p style="font-size:16px;color:#333;margin:0 0 24px;">
        You subscribed to release notifications for <strong>${escapeHtml(repoFullName)}</strong>.
      </p>
      <a href="${data.confirmUrl}" style="display:inline-block;background:#2ea44f;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:16px;">
        Confirm Subscription
      </a>
      <p style="font-size:13px;color:#6a737d;margin-top:16px;">
        Or copy this link: ${escapeHtml(data.confirmUrl)}
      </p>
      <p style="font-size:13px;color:#6a737d;margin-top:8px;">
        This link expires in 24 hours.
      </p>
      <hr style="margin-top:24px;border:none;border-top:1px solid #e1e4e8;">
      <p style="font-size:12px;color:#6a737d;margin-top:12px;">
        If you didn't subscribe, ignore this email or
        <a href="${data.unsubscribeUrl}" style="color:#6a737d;">unsubscribe</a>.
      </p>
    </div>
  `.trim();

  return { subject, html };
}

export type { ConfirmationEmailData };
