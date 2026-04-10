jest.mock('@/config', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 3000,
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    REDIS_URL: undefined,
    GITHUB_TOKEN: undefined,
    SMTP_HOST: 'smtp.test.com',
    SMTP_PORT: 587,
    SMTP_USER: 'user',
    SMTP_PASS: 'pass',
    SMTP_FROM: 'noreply@test.com',
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
  emailsSentTotal: { inc: jest.fn() },
  scannerNewReleasesFound: { inc: jest.fn() },
  scannerCyclesTotal: { inc: jest.fn() },
  httpRequestsTotal: { inc: jest.fn() },
  httpRequestDuration: { observe: jest.fn() },
}));

const mockSendMail = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
  getTestMessageUrl: jest.fn(() => null),
}));

import { sendEmail } from '@/notifier/emailSender';
import { emailsSentTotal } from '@/utils/metrics';

const mockMetricInc = emailsSentTotal.inc as jest.Mock;

describe('emailSender', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should send email successfully', async () => {
    mockSendMail.mockResolvedValueOnce({ messageId: 'msg-123' });

    await sendEmail('user@example.com', 'Test Subject', '<p>Hello</p>');

    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'noreply@test.com',
      to: 'user@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    });
    expect(mockMetricInc).toHaveBeenCalledWith({ status: 'success' });
  });

  it('should retry on failure and succeed on second attempt', async () => {
    mockSendMail
      .mockRejectedValueOnce(new Error('SMTP connection failed'))
      .mockResolvedValueOnce({ messageId: 'msg-456' });

    const promise = sendEmail('user@example.com', 'Test', '<p>Hi</p>');
    // First attempt fails → waits 4000ms (2^1 * 2000) before retry
    await jest.advanceTimersByTimeAsync(5000);
    await promise;

    expect(mockSendMail).toHaveBeenCalledTimes(2);
    expect(mockMetricInc).toHaveBeenCalledWith({ status: 'success' });
  });

  it('should retry 3 times and log error on total failure', async () => {
    const error = new Error('SMTP down');
    mockSendMail
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error);

    const promise = sendEmail('user@example.com', 'Test', '<p>Hi</p>');
    // Advance through all retry delays: 4s + 8s + 16s
    await jest.advanceTimersByTimeAsync(30000);
    await promise;

    // 1 initial + 3 retries = 4 attempts
    expect(mockSendMail).toHaveBeenCalledTimes(4);
    expect(mockMetricInc).toHaveBeenCalledWith({ status: 'failure' });
  });

  it('should not throw even when all retries fail', async () => {
    mockSendMail.mockRejectedValue(new Error('permanent failure'));

    const promise = sendEmail('user@example.com', 'Test', '<p>Hi</p>');
    await jest.advanceTimersByTimeAsync(30000);

    // Should resolve, not reject
    await expect(promise).resolves.toBeUndefined();
  });
});
