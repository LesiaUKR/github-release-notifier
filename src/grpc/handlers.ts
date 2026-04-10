import { type sendUnaryData, type ServerUnaryCall, status as GrpcStatus } from '@grpc/grpc-js';

import { AppError, ConflictError, NotFoundError, ValidationError } from '../errors';
import * as subscriptionService from '../services/subscriptionService';

interface CreateRequest {
  email: string;
  repo: string;
}

interface GetRequest {
  id: string;
}

interface DeleteRequest {
  id: string;
}

interface SubscriptionResponse {
  id: string;
  email: string;
  repo: string;
  created_at: string;
}

function mapErrorToGrpcStatus(error: unknown): { code: number; message: string } {
  if (error instanceof NotFoundError) {
    return { code: GrpcStatus.NOT_FOUND, message: error.message };
  }
  if (error instanceof ConflictError) {
    return { code: GrpcStatus.ALREADY_EXISTS, message: error.message };
  }
  if (error instanceof ValidationError) {
    return { code: GrpcStatus.INVALID_ARGUMENT, message: error.message };
  }
  if (error instanceof AppError) {
    return { code: GrpcStatus.INTERNAL, message: error.message };
  }
  return { code: GrpcStatus.INTERNAL, message: 'Internal server error' };
}

export async function createSubscription(
  call: ServerUnaryCall<CreateRequest, SubscriptionResponse>,
  callback: sendUnaryData<SubscriptionResponse>
): Promise<void> {
  try {
    const { email, repo } = call.request;
    const [owner, repoName] = repo.split('/');

    if (!owner || !repoName) {
      callback({
        code: GrpcStatus.INVALID_ARGUMENT,
        message: 'repo must be in "owner/repo" format',
      });
      return;
    }

    const subscription = await subscriptionService.createSubscription(email, owner, repoName);

    callback(null, {
      id: subscription.id,
      email: subscription.email,
      repo: `${subscription.owner}/${subscription.repo}`,
      created_at: subscription.createdAt.toISOString(),
    });
  } catch (error) {
    callback(mapErrorToGrpcStatus(error));
  }
}

export async function getSubscription(
  call: ServerUnaryCall<GetRequest, SubscriptionResponse>,
  callback: sendUnaryData<SubscriptionResponse>
): Promise<void> {
  try {
    const subscription = await subscriptionService.getSubscriptionById(call.request.id);

    callback(null, {
      id: subscription.id,
      email: subscription.email,
      repo: `${subscription.owner}/${subscription.repo}`,
      created_at: subscription.createdAt.toISOString(),
    });
  } catch (error) {
    callback(mapErrorToGrpcStatus(error));
  }
}

export async function deleteSubscription(
  call: ServerUnaryCall<DeleteRequest, object>,
  callback: sendUnaryData<object>
): Promise<void> {
  try {
    await subscriptionService.deleteSubscription(call.request.id);
    callback(null, {});
  } catch (error) {
    callback(mapErrorToGrpcStatus(error));
  }
}
