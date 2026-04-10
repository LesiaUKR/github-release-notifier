jest.mock('@/config', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 3000,
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    REDIS_URL: undefined,
    GITHUB_TOKEN: undefined,
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

jest.mock('@/utils/metrics', () => ({
  scannerNewReleasesFound: { inc: jest.fn() },
  scannerCyclesTotal: { inc: jest.fn() },
  httpRequestsTotal: { inc: jest.fn() },
  httpRequestDuration: { observe: jest.fn() },
  emailsSentTotal: { inc: jest.fn() },
}));

jest.mock('@/db', () => {
  const mockSet = jest.fn();
  const mockWhere = jest.fn();
  const mockUpdate = jest.fn(() => ({ set: mockSet }));
  mockSet.mockReturnValue({ where: mockWhere });

  return {
    db: {
      update: mockUpdate,
      _mocks: { mockUpdate, mockSet, mockWhere },
    },
  };
});

jest.mock('@/services/repositoryService');
jest.mock('@/services/subscriptionService');
jest.mock('@/services/cacheService');
jest.mock('@/scanner/githubClient');
jest.mock('@/notifier');

import { NotFoundError, RateLimitError } from '@/errors';
import { sendReleaseNotifications } from '@/notifier';
import * as githubClient from '@/scanner/githubClient';
import { checkAllRepositories } from '@/scanner/releaseChecker';
import * as cacheService from '@/services/cacheService';
import * as repositoryService from '@/services/repositoryService';
import * as subscriptionService from '@/services/subscriptionService';
import { scannerNewReleasesFound } from '@/utils/metrics';

const mockGetAllTracked = repositoryService.getAllTracked as jest.Mock;
const mockGetLatestRelease = githubClient.getLatestRelease as jest.Mock;
const mockGetRateLimitState = githubClient.getRateLimitState as jest.Mock;
const mockCacheGet = cacheService.get as jest.Mock;
const mockCacheSet = cacheService.set as jest.Mock;
const mockGetByOwnerRepo = subscriptionService.getByOwnerRepo as jest.Mock;
const mockSendNotifications = sendReleaseNotifications as jest.Mock;
const mockMetricInc = scannerNewReleasesFound.inc as jest.Mock;

const { db } = jest.requireMock('@/db') as {
  db: {
    update: jest.Mock;
    _mocks: { mockUpdate: jest.Mock; mockSet: jest.Mock; mockWhere: jest.Mock };
  };
};

const baseRepo = {
  id: 'repo-1',
  owner: 'facebook',
  repo: 'react',
  lastSeenTag: null as string | null,
  lastCheckedAt: null,
  createdAt: new Date('2025-01-01'),
};

const mockRelease = {
  tag_name: 'v18.2.0',
  name: 'React 18.2.0',
  html_url: 'https://github.com/facebook/react/releases/tag/v18.2.0',
  body: 'Release notes',
  published_at: '2025-01-01T00:00:00Z',
};

describe('releaseChecker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetRateLimitState.mockReturnValue({ remaining: 50, resetAt: null });
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    db._mocks.mockWhere.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should do nothing when no repositories to check', async () => {
    mockGetAllTracked.mockResolvedValueOnce([]);

    await checkAllRepositories();

    expect(mockGetLatestRelease).not.toHaveBeenCalled();
  });

  it('should store tag and NOT notify on first check (null lastSeenTag)', async () => {
    mockGetAllTracked.mockResolvedValueOnce([{ ...baseRepo, lastSeenTag: null }]);
    mockGetLatestRelease.mockResolvedValueOnce(mockRelease);

    const promise = checkAllRepositories();
    await jest.advanceTimersByTimeAsync(2000);
    await promise;

    expect(db.update).toHaveBeenCalled();
    expect(mockSendNotifications).not.toHaveBeenCalled();
  });

  it('should NOT notify when tag has not changed', async () => {
    mockGetAllTracked.mockResolvedValueOnce([{ ...baseRepo, lastSeenTag: 'v18.2.0' }]);
    mockGetLatestRelease.mockResolvedValueOnce(mockRelease);

    const promise = checkAllRepositories();
    await jest.advanceTimersByTimeAsync(2000);
    await promise;

    expect(mockSendNotifications).not.toHaveBeenCalled();
  });

  it('should notify subscribers when new release detected', async () => {
    const subscribers = [{ email: 'user@example.com' }, { email: 'user2@example.com' }];
    mockGetAllTracked.mockResolvedValueOnce([{ ...baseRepo, lastSeenTag: 'v18.1.0' }]);
    mockGetLatestRelease.mockResolvedValueOnce(mockRelease);
    mockGetByOwnerRepo.mockResolvedValueOnce(subscribers);
    mockSendNotifications.mockResolvedValueOnce(undefined);

    const promise = checkAllRepositories();
    await jest.advanceTimersByTimeAsync(2000);
    await promise;

    expect(mockSendNotifications).toHaveBeenCalledWith(subscribers, {
      owner: 'facebook',
      repo: 'react',
      tagName: 'v18.2.0',
      releaseName: 'React 18.2.0',
      htmlUrl: 'https://github.com/facebook/react/releases/tag/v18.2.0',
      body: 'Release notes',
    });
    expect(mockMetricInc).toHaveBeenCalled();
  });

  it('should stop cycle when rate limit is low', async () => {
    mockGetAllTracked.mockResolvedValueOnce([
      { ...baseRepo, id: 'repo-1', lastSeenTag: 'v1.0.0' },
      { ...baseRepo, id: 'repo-2', repo: 'vue', lastSeenTag: 'v3.0.0' },
    ]);
    mockGetRateLimitState.mockReturnValue({ remaining: 3, resetAt: null });

    await checkAllRepositories();

    expect(mockGetLatestRelease).not.toHaveBeenCalled();
  });

  it('should continue checking other repos when one has no releases (404)', async () => {
    const secondRepo = { ...baseRepo, id: 'repo-2', repo: 'vue', lastSeenTag: 'v3.0.0' };
    mockGetAllTracked.mockResolvedValueOnce([{ ...baseRepo, lastSeenTag: 'v18.1.0' }, secondRepo]);
    mockGetLatestRelease
      .mockRejectedValueOnce(new NotFoundError('No releases'))
      .mockResolvedValueOnce({ ...mockRelease, tag_name: 'v3.0.0' });

    const promise = checkAllRepositories();
    await jest.advanceTimersByTimeAsync(5000);
    await promise;

    expect(mockGetLatestRelease).toHaveBeenCalledTimes(2);
  });

  it('should stop cycle entirely on RateLimitError', async () => {
    const secondRepo = { ...baseRepo, id: 'repo-2', repo: 'vue', lastSeenTag: 'v3.0.0' };
    mockGetAllTracked.mockResolvedValueOnce([{ ...baseRepo, lastSeenTag: 'v18.1.0' }, secondRepo]);
    mockGetLatestRelease.mockRejectedValueOnce(new RateLimitError('Rate limit exceeded'));

    const promise = checkAllRepositories();
    await jest.advanceTimersByTimeAsync(5000);
    await promise;

    expect(mockGetLatestRelease).toHaveBeenCalledTimes(1);
  });

  it('should use cached release data when available', async () => {
    mockGetAllTracked.mockResolvedValueOnce([{ ...baseRepo, lastSeenTag: 'v18.1.0' }]);
    mockCacheGet.mockResolvedValueOnce(mockRelease);
    mockGetByOwnerRepo.mockResolvedValueOnce([]);
    mockSendNotifications.mockResolvedValueOnce(undefined);

    const promise = checkAllRepositories();
    await jest.advanceTimersByTimeAsync(2000);
    await promise;

    expect(mockGetLatestRelease).not.toHaveBeenCalled();
    expect(mockSendNotifications).toHaveBeenCalled();
  });
});
