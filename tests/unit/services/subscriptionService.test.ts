import { ConflictError, NotFoundError } from '@/errors';
import * as repositoryService from '@/services/repositoryService';
import * as subscriptionService from '@/services/subscriptionService';

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
    BASE_URL: 'http://localhost:3000',
  },
}));

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
  const mockUpdateSet = jest.fn(() => ({
    where: jest.fn(() => ({ returning: mockReturning })),
  }));
  const mockUpdate = jest.fn(() => ({ set: mockUpdateSet }));

  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      delete: mockDelete,
      update: mockUpdate,
      _mocks: {
        mockSelect,
        mockFrom,
        mockWhere,
        mockInsert,
        mockValues,
        mockReturning,
        mockDelete,
        mockUpdate,
        mockUpdateSet,
      },
    },
  };
});

jest.mock('@/services/repositoryService');

const { db } = jest.requireMock('@/db') as {
  db: {
    select: jest.Mock;
    insert: jest.Mock;
    delete: jest.Mock;
    update: jest.Mock;
    _mocks: {
      mockSelect: jest.Mock;
      mockFrom: jest.Mock;
      mockWhere: jest.Mock;
      mockInsert: jest.Mock;
      mockValues: jest.Mock;
      mockReturning: jest.Mock;
      mockDelete: jest.Mock;
      mockUpdate: jest.Mock;
      mockUpdateSet: jest.Mock;
    };
  };
};

const mockValidateAndUpsert = repositoryService.validateAndUpsert as jest.Mock;

const mockSubscription = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  owner: 'facebook',
  repo: 'react',
  status: 'pending',
  confirmationToken: 'test-token-uuid',
  tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  createdAt: new Date('2025-01-01'),
};

describe('subscriptionService', () => {
  beforeEach(() => {
    mockValidateAndUpsert.mockResolvedValue(undefined);
  });

  describe('createSubscription', () => {
    it('should create a subscription with pending status', async () => {
      db._mocks.mockWhere.mockResolvedValueOnce([]);
      db._mocks.mockReturning.mockResolvedValueOnce([mockSubscription]);

      const result = await subscriptionService.createSubscription(
        'test@example.com',
        'facebook',
        'react'
      );

      expect(mockValidateAndUpsert).toHaveBeenCalledWith('facebook', 'react');
      expect(result).toEqual(mockSubscription);
      expect(result.status).toBe('pending');
      expect(result.confirmationToken).toBeDefined();
    });

    it('should throw ConflictError if subscription is active', async () => {
      db._mocks.mockWhere.mockResolvedValueOnce([{ ...mockSubscription, status: 'active' }]);

      await expect(
        subscriptionService.createSubscription('test@example.com', 'facebook', 'react')
      ).rejects.toThrow(ConflictError);
    });

    it('should throw ConflictError if pending and token not expired', async () => {
      db._mocks.mockWhere.mockResolvedValueOnce([
        { ...mockSubscription, status: 'pending', tokenExpiresAt: new Date(Date.now() + 100000) },
      ]);

      await expect(
        subscriptionService.createSubscription('test@example.com', 'facebook', 'react')
      ).rejects.toThrow(ConflictError);
    });

    it('should reactivate if pending and token expired', async () => {
      db._mocks.mockWhere.mockResolvedValueOnce([
        { ...mockSubscription, status: 'pending', tokenExpiresAt: new Date(Date.now() - 100000) },
      ]);
      db._mocks.mockReturning.mockResolvedValueOnce([
        { ...mockSubscription, status: 'pending', confirmationToken: 'new-token' },
      ]);

      const result = await subscriptionService.createSubscription(
        'test@example.com',
        'facebook',
        'react'
      );

      expect(db.update).toHaveBeenCalled();
      expect(result.status).toBe('pending');
    });

    it('should reactivate inactive subscription', async () => {
      db._mocks.mockWhere.mockResolvedValueOnce([{ ...mockSubscription, status: 'inactive' }]);
      db._mocks.mockReturning.mockResolvedValueOnce([
        { ...mockSubscription, status: 'pending', confirmationToken: 'new-token' },
      ]);

      const result = await subscriptionService.createSubscription(
        'test@example.com',
        'facebook',
        'react'
      );

      expect(db.update).toHaveBeenCalled();
      expect(result.status).toBe('pending');
    });
  });

  describe('confirmSubscription', () => {
    it('should activate a pending subscription', async () => {
      db._mocks.mockWhere.mockResolvedValueOnce([mockSubscription]);
      db._mocks.mockReturning.mockResolvedValueOnce([{ ...mockSubscription, status: 'active' }]);

      const result = await subscriptionService.confirmSubscription('test-token-uuid');

      expect(result.status).toBe('active');
    });

    it('should return subscription if already active', async () => {
      db._mocks.mockWhere.mockResolvedValueOnce([{ ...mockSubscription, status: 'active' }]);

      const result = await subscriptionService.confirmSubscription('test-token-uuid');

      expect(result.status).toBe('active');
    });

    it('should throw NotFoundError for invalid token', async () => {
      db._mocks.mockWhere.mockResolvedValueOnce([]);

      await expect(subscriptionService.confirmSubscription('bad-token')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw NotFoundError if token expired', async () => {
      db._mocks.mockWhere.mockResolvedValueOnce([
        { ...mockSubscription, tokenExpiresAt: new Date(Date.now() - 100000) },
      ]);

      await expect(subscriptionService.confirmSubscription('test-token-uuid')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw NotFoundError if subscription is inactive', async () => {
      db._mocks.mockWhere.mockResolvedValueOnce([{ ...mockSubscription, status: 'inactive' }]);

      await expect(subscriptionService.confirmSubscription('test-token-uuid')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('unsubscribeByToken', () => {
    it('should deactivate subscription', async () => {
      db._mocks.mockWhere.mockResolvedValueOnce([{ ...mockSubscription, status: 'active' }]);
      db._mocks.mockReturning.mockResolvedValueOnce([{ ...mockSubscription, status: 'inactive' }]);

      const result = await subscriptionService.unsubscribeByToken('test-token-uuid');

      expect(result.status).toBe('inactive');
    });

    it('should throw NotFoundError for invalid token', async () => {
      db._mocks.mockWhere.mockResolvedValueOnce([]);

      await expect(subscriptionService.unsubscribeByToken('bad-token')).rejects.toThrow(
        NotFoundError
      );
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
    it('should return only active subscriptions', async () => {
      const activeSub = { ...mockSubscription, status: 'active' };
      db._mocks.mockWhere.mockResolvedValueOnce([activeSub]);

      const result = await subscriptionService.getByOwnerRepo('facebook', 'react');

      expect(result).toEqual([activeSub]);
    });

    it('should return empty array if no subscriptions', async () => {
      db._mocks.mockWhere.mockResolvedValueOnce([]);

      const result = await subscriptionService.getByOwnerRepo('facebook', 'react');

      expect(result).toEqual([]);
    });
  });
});
