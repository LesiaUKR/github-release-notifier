import { config } from '../config';
import { AppError, NotFoundError, RateLimitError } from '../errors';
import { logger } from '../utils/logger';

const GITHUB_API = 'https://api.github.com';

interface GitHubRepo {
  full_name: string;
  description: string | null;
}

interface GitHubRelease {
  tag_name: string;
  name: string | null;
  html_url: string;
  body: string | null;
  published_at: string;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'github-release-notifier',
  };

  if (config.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${config.GITHUB_TOKEN}`;
  }

  return headers;
}

async function handleResponse<T>(response: Response, context: string): Promise<T> {
  const remaining = response.headers.get('x-ratelimit-remaining');
  if (remaining) {
    logger.debug(`GitHub API rate limit remaining: ${remaining}`);
  }

  if (response.ok) {
    return (await response.json()) as T;
  }

  if (response.status === 404) {
    throw new NotFoundError(`GitHub ${context} not found`);
  }

  if (response.status === 403 || response.status === 429) {
    const resetHeader = response.headers.get('x-ratelimit-reset');
    const retryAfter = resetHeader
      ? Math.max(0, Number(resetHeader) - Math.floor(Date.now() / 1000))
      : undefined;
    throw new RateLimitError(`GitHub API rate limit exceeded`, retryAfter);
  }

  throw new AppError(
    `GitHub API error: ${response.status} ${response.statusText}`,
    response.status
  );
}

export async function getRepository(owner: string, repo: string): Promise<GitHubRepo> {
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
    headers: buildHeaders(),
  });

  return handleResponse<GitHubRepo>(response, `repository ${owner}/${repo}`);
}

export async function getLatestRelease(owner: string, repo: string): Promise<GitHubRelease> {
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/releases/latest`, {
    headers: buildHeaders(),
  });

  return handleResponse<GitHubRelease>(response, `release for ${owner}/${repo}`);
}

export type { GitHubRelease, GitHubRepo };
