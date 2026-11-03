import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { usageController } from './usage.controller';

const router = Router();
router.use(authenticate);

router.get('/today', (req, res, next) => usageController.getToday(req, res, next));
router.get('/history', (req, res, next) => usageController.getHistory(req, res, next));
router.post('/sync', (req, res, next) => usageController.sync(req, res, next));
router.get('/summary', (req, res, next) => usageController.getSummary(req, res, next));

export { router as usageRouter };
