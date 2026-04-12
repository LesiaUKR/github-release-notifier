import { buildReleaseEmail } from '@/notifier/templates/releaseNotification';

const baseData = {
  owner: 'ollama',
  repo: 'ollama',
  tagName: 'v0.20.5',
  releaseName: 'v0.20.5',
  htmlUrl: 'https://github.com/ollama/ollama/releases/tag/v0.20.5',
  unsubscribeUrl: 'https://example.com/unsubscribe/token',
};

describe('releaseNotification template', () => {
  it('renders markdown images as image blocks instead of plain text markup', () => {
    const body = [
      '## OpenClaw channel setup',
      '![CleanShot](https://github.com/user-attachments/assets/3a6882c4-5c6e-4724-8f6e-56ff2df39f6f)',
      'More details',
    ].join('\n');

    const { html } = buildReleaseEmail({ ...baseData, body });

    expect(html).toContain(
      'src="https://github.com/user-attachments/assets/3a6882c4-5c6e-4724-8f6e-56ff2df39f6f"'
    );
    expect(html).not.toContain('![CleanShot]');
  });

  it('extracts image URLs from raw <img> tags', () => {
    const body = [
      '<img width="2292" src="https://example.com/screenshots/release.png" />',
      'Text after image',
    ].join('\n');

    const { html } = buildReleaseEmail({ ...baseData, body });

    expect(html).toContain('src="https://example.com/screenshots/release.png"');
    expect(html).not.toContain('&lt;img');
  });

  it('keeps notes escaped but converts plain URLs to clickable links', () => {
    const body = '<script>alert("x")</script>\nDocs: https://example.com/docs';

    const { html } = buildReleaseEmail({ ...baseData, body });

    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).toContain('<a href="https://example.com/docs"');
  });
});
