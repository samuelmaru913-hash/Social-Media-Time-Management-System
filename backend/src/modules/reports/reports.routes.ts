import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { reportsController } from './reports.controller';

const router = Router();
router.use(authenticate);

router.get('/daily', (req, res, next) => reportsController.daily(req, res, next));
router.get('/weekly', (req, res, next) => reportsController.weekly(req, res, next));
router.get('/monthly', (req, res, next) => reportsController.monthly(req, res, next));

export { router as reportsRouter };
