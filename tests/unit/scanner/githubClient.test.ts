jest.mock('@/config', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 3000,
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    REDIS_URL: undefined,
    GITHUB_TOKEN: 'test-token',
    SMTP_HOST: undefined,
    SMTP_PORT: 587,
    SMTP_USER: undefined,
    SMTP_PASS: undefined,
    SMTP_FROM: 'test@test.com',
    SCAN_INTERVAL_MS: 300000,
    GRPC_PORT: 50051,
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { NotFoundError, RateLimitError } from '@/errors';
import * as githubClient from '@/scanner/githubClient';

function createMockResponse(options: {
  ok: boolean;
  status: number;
  statusText?: string;
  body?: unknown;
  headers?: Record<string, string>;
}): Response {
  const headers = new Headers(options.headers ?? {});

  return {
    ok: options.ok,
    status: options.status,
    statusText: options.statusText ?? '',
    json: jest.fn().mockResolvedValue(options.body ?? {}),
    headers,
  } as unknown as Response;
}

describe('githubClient', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('getRepository', () => {
    it('should return repository data on success', async () => {
      const mockRepo = { full_name: 'facebook/react', description: 'A JS library' };

      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          body: mockRepo,
          headers: { 'x-ratelimit-remaining': '50' },
        })
      );

      const result = await githubClient.getRepository('facebook', 'react');

      expect(result).toEqual(mockRepo);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/facebook/react',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should throw NotFoundError on 404', async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 404,
          headers: { 'x-ratelimit-remaining': '50' },
        })
      );

      await expect(githubClient.getRepository('facebook', 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw RateLimitError on 429', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 60;

      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 429,
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(resetTime),
          },
        })
      );

      await expect(githubClient.getRepository('facebook', 'react')).rejects.toThrow(RateLimitError);
    });

    it('should throw RateLimitError on 403 (rate limit)', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 120;

      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 403,
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(resetTime),
          },
        })
      );

      await expect(githubClient.getRepository('facebook', 'react')).rejects.toThrow(RateLimitError);
    });
  });

  describe('getLatestRelease', () => {
    it('should return release data on success', async () => {
      const mockRelease = {
        tag_name: 'v18.2.0',
        name: 'React 18.2.0',
        html_url: 'https://github.com/facebook/react/releases/tag/v18.2.0',
        body: 'Release notes',
        published_at: '2025-01-01T00:00:00Z',
      };

      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          body: mockRelease,
          headers: { 'x-ratelimit-remaining': '45' },
        })
      );

      const result = await githubClient.getLatestRelease('facebook', 'react');

      expect(result).toEqual(mockRelease);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/facebook/react/releases/latest',
        expect.any(Object)
      );
    });

    it('should throw NotFoundError when no releases exist', async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 404,
          headers: { 'x-ratelimit-remaining': '45' },
        })
      );

      await expect(githubClient.getLatestRelease('facebook', 'react')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('getRateLimitState', () => {
    it('should return rate limit state from last response', async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          body: { full_name: 'facebook/react', description: null },
          headers: {
            'x-ratelimit-remaining': '42',
            'x-ratelimit-reset': '1700000000',
          },
        })
      );

      await githubClient.getRepository('facebook', 'react');
      const state = githubClient.getRateLimitState();

      expect(state.remaining).toBe(42);
      expect(state.resetAt).toBe(1700000000000);
    });
  });
});
