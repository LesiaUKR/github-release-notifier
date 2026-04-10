import { ConflictError, NotFoundError } from '@/errors';
import * as repositoryService from '@/services/repositoryService';
import * as subscriptionService from '@/services/subscriptionService';

// Must be first — prevents process.exit(1) from config validation
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

// Mock db module — Drizzle query chain
jest.mock('@/db', () => {
  const mockReturning = jest.fn();
  const mockWhere = jest.fn();
  const mockFrom = jest.fn(() => ({ where: mockWhere }));
  const mockValues = jest.fn(() => ({ returning: mockReturning }));
  const mockInsert = jest.fn(() => ({ values: mockValues }));
  const mockSelect = jest.fn(() => ({ from: mockFrom }));
  const mockDelete = jest.fn(() => ({
    where: jest.fn(() => ({ returning: mockReturning })),
  }));

  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      delete: mockDelete,
      _mocks: {
        mockSelect,
        mockFrom,
        mockWhere,
        mockInsert,
        mockValues,
        mockReturning,
        mockDelete,
      },
    },
  };
});

// Mock repositoryService — we don't test it here
jest.mock('@/services/repositoryService');

// Access mock internals for assertions
const { db } = jest.requireMock('@/db') as {
  db: {
    select: jest.Mock;
    insert: jest.Mock;
    delete: jest.Mock;
    _mocks: {
      mockSelect: jest.Mock;
      mockFrom: jest.Mock;
      mockWhere: jest.Mock;
      mockInsert: jest.Mock;
      mockValues: jest.Mock;
      mockReturning: jest.Mock;
      mockDelete: jest.Mock;
    };
  };
};

const mockValidateAndUpsert = repositoryService.validateAndUpsert as jest.Mock;

const mockSubscription = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  owner: 'facebook',
  repo: 'react',
  createdAt: new Date('2025-01-01'),
};

describe('subscriptionService', () => {
  beforeEach(() => {
    mockValidateAndUpsert.mockResolvedValue(undefined);
  });

  describe('createSubscription', () => {
    it('should create a subscription successfully', async () => {
      db._mocks.mockWhere.mockResolvedValueOnce([]);
      db._mocks.mockReturning.mockResolvedValueOnce([mockSubscription]);

      const result = await subscriptionService.createSubscription(
        'test@example.com',
        'facebook',
        'react'
      );

      expect(mockValidateAndUpsert).toHaveBeenCalledWith('facebook', 'react');
      expect(result).toEqual(mockSubscription);
    });

    it('should throw ConflictError if subscription already exists', async () => {
      db._mocks.mockWhere.mockResolvedValueOnce([mockSubscription]);

      await expect(
        subscriptionService.createSubscription('test@example.com', 'facebook', 'react')
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('getSubscriptionById', () => {
    it('should return subscription by id', async () => {
      db._mocks.mockWhere.mockResolvedValueOnce([mockSubscription]);

      const result = await subscriptionService.getSubscriptionById(mockSubscription.id);

      expect(result).toEqual(mockSubscription);
    });

    it('should throw NotFoundError if subscription does not exist', async () => {
      db._mocks.mockWhere.mockResolvedValueOnce([]);

      await expect(subscriptionService.getSubscriptionById('nonexistent-id')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('deleteSubscription', () => {
    it('should delete subscription successfully', async () => {
      const mockDeleteWhere = jest.fn(() => ({
        returning: jest.fn().mockResolvedValueOnce([mockSubscription]),
      }));
      db.delete.mockReturnValueOnce({ where: mockDeleteWhere });

      await expect(
        subscriptionService.deleteSubscription(mockSubscription.id)
      ).resolves.toBeUndefined();
    });

    it('should throw NotFoundError if subscription does not exist', async () => {
      const mockDeleteWhere = jest.fn(() => ({
        returning: jest.fn().mockResolvedValueOnce([]),
      }));
      db.delete.mockReturnValueOnce({ where: mockDeleteWhere });

      await expect(subscriptionService.deleteSubscription('nonexistent-id')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('getByOwnerRepo', () => {
    it('should return subscriptions for owner/repo', async () => {
      db._mocks.mockWhere.mockResolvedValueOnce([mockSubscription]);

      const result = await subscriptionService.getByOwnerRepo('facebook', 'react');

      expect(result).toEqual([mockSubscription]);
    });

    it('should return empty array if no subscriptions', async () => {
      db._mocks.mockWhere.mockResolvedValueOnce([]);

      const result = await subscriptionService.getByOwnerRepo('facebook', 'react');

      expect(result).toEqual([]);
    });
  });
});
