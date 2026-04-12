import path from 'node:path';

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { ReflectionService } from '@grpc/reflection';

import { config } from '../config';
import { logger } from '../utils/logger';
import * as handlers from './handlers';

const PROTO_PATH = path.join(__dirname, '../../proto/subscriptions.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const subscriptionsProto = grpc.loadPackageDefinition(packageDefinition)
  .subscriptions as grpc.GrpcObject;

export function startGrpcServer(): grpc.Server {
  const server = new grpc.Server();

  server.addService(
    (subscriptionsProto.SubscriptionService as grpc.ServiceClientConstructor).service,
    {
      CreateSubscription: handlers.createSubscription,
      GetSubscription: handlers.getSubscription,
      DeleteSubscription: handlers.deleteSubscription,
    }
  );

  const reflection = new ReflectionService(packageDefinition);
  reflection.addToServer(server);

  server.bindAsync(
    `0.0.0.0:${config.GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        logger.error('gRPC server failed to start:', error);
        return;
      }
      logger.info(`gRPC server running on port ${port}`);
    }
  );

  return server;
}
