import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import * as subscriptionController from '../controllers/subscriptionController';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { validate } from '../middleware/validate';
import { createSubscriptionSchema, idParamSchema } from '../schemas/subscription';

const subscribeLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'TooManyRequests', message: 'Too many subscription requests, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.post('/', subscribeLimit, validate(createSubscriptionSchema), subscriptionController.create);
router.get('/:id', apiKeyAuth, validate(idParamSchema, 'params'), subscriptionController.getById);
router.delete('/:id', apiKeyAuth, validate(idParamSchema, 'params'), subscriptionController.remove);

export default router;
