import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { notificationsController } from './notifications.controller';

const router = Router();
router.use(authenticate);

router.get('/preferences', (req, res, next) => notificationsController.getPreferences(req, res, next));
router.patch('/preferences', (req, res, next) => notificationsController.updatePreferences(req, res, next));

export { router as notificationsRouter };
