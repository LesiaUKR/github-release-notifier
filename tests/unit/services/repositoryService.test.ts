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

jest.mock('@/db', () => {
  const mockWhere = jest.fn();
  const mockFrom = jest.fn(() => ({ where: mockWhere }));
  const mockSelect = jest.fn(() => ({ from: mockFrom }));
  const mockReturning = jest.fn();
  const mockOnConflictDoUpdate = jest.fn(() => ({ returning: mockReturning }));
  const mockValues = jest.fn(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
  const mockInsert = jest.fn(() => ({ values: mockValues }));

  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      _mocks: {
        mockSelect,
        mockFrom,
        mockWhere,
        mockInsert,
        mockValues,
        mockOnConflictDoUpdate,
        mockReturning,
      },
    },
  };
});

jest.mock('@/services/cacheService');
jest.mock('@/scanner/githubClient');

import { NotFoundError, RateLimitError } from '@/errors';
import * as githubClient from '@/scanner/githubClient';
import * as cacheService from '@/services/cacheService';
import * as repositoryService from '@/services/repositoryService';

const { db } = jest.requireMock('@/db') as {
  db: {
    select: jest.Mock;
    insert: jest.Mock;
    _mocks: {
      mockSelect: jest.Mock;
      mockFrom: jest.Mock;
      mockWhere: jest.Mock;
      mockInsert: jest.Mock;
      mockValues: jest.Mock;
      mockOnConflictDoUpdate: jest.Mock;
      mockReturning: jest.Mock;
    };
  };
};

const mockCacheGet = cacheService.get as jest.Mock;
const mockCacheSet = cacheService.set as jest.Mock;
const mockGetRepository = githubClient.getRepository as jest.Mock;

const mockRepository = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  owner: 'facebook',
  repo: 'react',
  lastSeenTag: null,
  lastCheckedAt: null,
  createdAt: new Date('2025-01-01'),
};

const mockGitHubRepo = {
  full_name: 'facebook/react',
  description: 'A JavaScript library for building user interfaces',
};

describe('repositoryService', () => {
  describe('validateAndUpsert', () => {
    it('should use cached data and not call GitHub API', async () => {
      mockCacheGet.mockResolvedValueOnce(mockGitHubRepo);
      db._mocks.mockReturning.mockResolvedValueOnce([mockRepository]);

      const result = await repositoryService.validateAndUpsert('facebook', 'react');

      expect(mockCacheGet).toHaveBeenCalledWith('github:repo:facebook/react');
      expect(mockGetRepository).not.toHaveBeenCalled();
      expect(result).toEqual(mockRepository);
    });

    it('should call GitHub API on cache miss and save to cache', async () => {
      mockCacheGet.mockResolvedValueOnce(null);
      mockGetRepository.mockResolvedValueOnce(mockGitHubRepo);
      mockCacheSet.mockResolvedValueOnce(undefined);
      db._mocks.mockReturning.mockResolvedValueOnce([mockRepository]);

      const result = await repositoryService.validateAndUpsert('facebook', 'react');

      expect(mockGetRepository).toHaveBeenCalledWith('facebook', 'react');
      expect(mockCacheSet).toHaveBeenCalledWith('github:repo:facebook/react', mockGitHubRepo, 600);
      expect(result).toEqual(mockRepository);
    });

    it('should propagate NotFoundError from GitHub API', async () => {
      mockCacheGet.mockResolvedValueOnce(null);
      mockGetRepository.mockRejectedValueOnce(
        new NotFoundError('GitHub repository facebook/nonexistent not found')
      );

      await expect(repositoryService.validateAndUpsert('facebook', 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should propagate RateLimitError from GitHub API', async () => {
      mockCacheGet.mockResolvedValueOnce(null);
      mockGetRepository.mockRejectedValueOnce(
        new RateLimitError('GitHub API rate limit exceeded', 60)
      );

      await expect(repositoryService.validateAndUpsert('facebook', 'react')).rejects.toThrow(
        RateLimitError
      );
    });
  });

  describe('getAllTracked', () => {
    it('should return all repositories', async () => {
      const mockRepos = [mockRepository, { ...mockRepository, id: 'another-id', repo: 'vue' }];
      db._mocks.mockFrom.mockResolvedValueOnce(mockRepos);

      const result = await repositoryService.getAllTracked();

      expect(result).toEqual(mockRepos);
    });

    it('should return empty array if no repositories', async () => {
      db._mocks.mockFrom.mockResolvedValueOnce([]);

      const result = await repositoryService.getAllTracked();

      expect(result).toEqual([]);
    });
  });
});
