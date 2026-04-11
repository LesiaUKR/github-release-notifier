import cors from 'cors';
import express from 'express';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';

import { errorHandler } from './middleware/errorHandler';
import { metricsMiddleware } from './middleware/metricsMiddleware';
import confirmRoutes from './routes/confirm';
import subscriptionRoutes from './routes/subscriptions';
import { register } from './utils/metrics';

const app = express();
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(metricsMiddleware);

function setupSwagger(app: express.Express): void {
  const swaggerPath = path.join(__dirname, '..', 'swagger.yaml');
  const swaggerDocument = YAML.parse(fs.readFileSync(swaggerPath, 'utf-8'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

setupSwagger(app);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});

app.use(confirmRoutes);
app.use('/subscriptions', subscriptionRoutes);

app.use(errorHandler);

export default app;
