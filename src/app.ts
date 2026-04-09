import cors from 'cors';
import express from 'express';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';

import { errorHandler } from './middleware/errorHandler';
import subscriptionRoutes from './routes/subscriptions';

const app = express();
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100kb' }));

function setupSwagger(app: express.Express): void {
  const swaggerPath = path.join(__dirname, '..', 'swagger.yaml');
  const swaggerDocument = YAML.parse(fs.readFileSync(swaggerPath, 'utf-8'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

setupSwagger(app);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/subscriptions', subscriptionRoutes);

app.use(errorHandler);

export default app;
