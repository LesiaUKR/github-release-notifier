import { Router } from 'express';

import * as subscriptionController from '../controllers/subscriptionController';
import { validate } from '../middleware/validate';
import { createSubscriptionSchema, idParamSchema } from '../schemas/subscription';

const router = Router();

router.post('/', validate(createSubscriptionSchema), subscriptionController.create);
router.get('/:id', validate(idParamSchema, 'params'), subscriptionController.getById);
router.delete('/:id', validate(idParamSchema, 'params'), subscriptionController.remove);

export default router;
