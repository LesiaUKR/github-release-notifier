import { Router } from 'express';

import * as confirmController from '../controllers/confirmController';

const router = Router();

router.get('/confirm/:token', confirmController.confirm);
router.get('/unsubscribe/:token', confirmController.unsubscribe);

export default router;
