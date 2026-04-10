// src/notifier/templates/releaseNotification.ts

const MAX_BODY_LENGTH = 500;

interface ReleaseEmailData {
  owner: string;
  repo: string;
  tagName: string;
  releaseName: string | null;
  htmlUrl: string;
  body: string | null;
}

interface EmailContent {
  subject: string;
  html: string;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '…';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildReleaseEmail(data: ReleaseEmailData): EmailContent {
  const repoFullName = `${data.owner}/${data.repo}`;
  const title = data.releaseName || data.tagName;

  const subject = `New release: ${repoFullName} ${data.tagName}`;

  const releaseNotes = data.body
    ? `<div style="background:#f6f8fa;padding:16px;border-radius:6px;margin-top:16px;">
        <h3 style="margin:0 0 8px;">Release Notes</h3>
        <p style="margin:0;white-space:pre-wrap;">${escapeHtml(truncate(data.body, MAX_BODY_LENGTH))}</p>
      </div>`
    : '';

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 8px;">🚀 ${escapeHtml(repoFullName)}</h2>
      <p style="font-size:18px;margin:0 0 16px;color:#333;">
        <strong>${escapeHtml(title)}</strong>
      </p>
      <a href="${data.htmlUrl}" style="display:inline-block;background:#2ea44f;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;">
        View Release on GitHub
      </a>
      ${releaseNotes}
      <hr style="margin-top:24px;border:none;border-top:1px solid #e1e4e8;">
      <p style="font-size:12px;color:#6a737d;margin-top:12px;">
        You received this email because you subscribed to releases of ${escapeHtml(repoFullName)}.
      </p>
    </div>
  `.trim();

  return { subject, html };
}

export type { EmailContent, ReleaseEmailData };
