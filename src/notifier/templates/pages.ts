import { escapeHtml } from './helpers';

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f6f8fa; }
    .card { background: #fff; border-radius: 12px; padding: 48px; max-width: 480px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.12); }
    h1 { margin: 0 0 16px; font-size: 24px; }
    p { color: #333; font-size: 16px; margin: 0 0 8px; }
    .muted { color: #6a737d; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">${body}</div>
</body>
</html>`;
}

export function confirmSuccessPage(owner: string, repo: string): string {
  return page(
    'Subscription Confirmed',
    `<h1>✅ Subscription Confirmed!</h1>
     <p>You'll receive notifications for new releases of <strong>${escapeHtml(owner)}/${escapeHtml(repo)}</strong>.</p>`
  );
}

export function confirmErrorPage(message: string): string {
  return page(
    'Confirmation Failed',
    `<h1>❌ Confirmation Failed</h1>
     <p class="muted">${escapeHtml(message)}</p>`
  );
}

export function unsubscribeSuccessPage(owner: string, repo: string): string {
  return page(
    'Unsubscribed',
    `<h1>Unsubscribed</h1>
     <p>You will no longer receive release notifications for <strong>${escapeHtml(owner)}/${escapeHtml(repo)}</strong>.</p>
     <p class="muted">You can resubscribe at any time.</p>`
  );
}

export function unsubscribeErrorPage(message: string): string {
  return page(
    'Unsubscribe Failed',
    `<h1>❌ Unsubscribe Failed</h1>
     <p class="muted">${escapeHtml(message)}</p>`
  );
}
