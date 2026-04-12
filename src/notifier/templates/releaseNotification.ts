import { escapeHtml } from './helpers';

const MAX_BODY_LENGTH = 1200;
const MAX_IMAGE_COUNT = 3;

interface ReleaseEmailData {
  owner: string;
  repo: string;
  tagName: string;
  releaseName: string | null;
  htmlUrl: string;
  body: string | null;
  unsubscribeUrl: string;
}

interface EmailContent {
  subject: string;
  html: string;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractImageUrls(text: string): string[] {
  const urls = new Set<string>();
  const markdownImageRegex = /!\[[^\]]*]\((https?:\/\/[^\s)]+)\)/gi;
  const htmlImageRegex = /<img[^>]*src=["'](https?:\/\/[^"']+)["'][^>]*>/gi;

  for (const match of text.matchAll(markdownImageRegex)) {
    const url = match[1];
    if (isSafeHttpUrl(url)) {
      urls.add(url);
    }
  }

  for (const match of text.matchAll(htmlImageRegex)) {
    const url = match[1];
    if (isSafeHttpUrl(url)) {
      urls.add(url);
    }
  }

  return Array.from(urls).slice(0, MAX_IMAGE_COUNT);
}

function stripInlineImageMarkup(text: string): string {
  return text
    .replace(/!\[[^\]]*]\((https?:\/\/[^\s)]+)\)/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .trim();
}

function linkifyUrls(text: string): string {
  return text.replace(/https?:\/\/[^\s<]+/g, url => {
    return `<a href="${url}" style="color:#0969da;text-decoration:underline;">${url}</a>`;
  });
}

function renderReleaseNotesText(text: string): string {
  const withoutImages = stripInlineImageMarkup(text);
  if (!withoutImages) {
    return '';
  }

  const escaped = escapeHtml(truncate(withoutImages, MAX_BODY_LENGTH));
  const withLinks = linkifyUrls(escaped);
  return withLinks.replace(/\r?\n/g, '<br>');
}

function renderImageGallery(imageUrls: string[]): string {
  if (imageUrls.length === 0) {
    return '';
  }

  const imagesHtml = imageUrls
    .map(url => {
      const safeUrl = escapeHtml(url);
      return `<a href="${safeUrl}" style="display:block;margin-top:12px;">
        <img src="${safeUrl}" alt="Release image" style="max-width:100%;height:auto;border-radius:6px;border:1px solid #d0d7de;display:block;">
      </a>`;
    })
    .join('');

  return `<div style="margin-top:12px;">${imagesHtml}</div>`;
}

export function buildReleaseEmail(data: ReleaseEmailData): EmailContent {
  const repoFullName = `${data.owner}/${data.repo}`;
  const title = data.releaseName || data.tagName;

  const subject = `New release: ${repoFullName} ${data.tagName}`;

  const releaseNotesText = data.body ? renderReleaseNotesText(data.body) : '';
  const imageUrls = data.body ? extractImageUrls(data.body) : [];
  const releaseNotes = data.body
    ? `<div style="background:#f6f8fa;padding:16px;border-radius:6px;margin-top:16px;">
        <h3 style="margin:0 0 8px;">Release Notes</h3>
        ${
          releaseNotesText
            ? `<p style="margin:0;white-space:normal;line-height:1.5;">${releaseNotesText}</p>`
            : ''
        }
        ${renderImageGallery(imageUrls)}
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
      <br>
      <a href="${data.unsubscribeUrl}" style="color:#6a737d;">Unsubscribe</a>
      </p>
    </div>
  `.trim();

  return { subject, html };
}

export type { EmailContent, ReleaseEmailData };
