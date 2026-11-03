import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { applicationsController } from './applications.controller';

const router = Router();
router.use(authenticate);

router.get('/', (req, res, next) => applicationsController.list(req, res, next));
router.post('/', (req, res, next) => applicationsController.create(req, res, next));
router.patch('/:id', (req, res, next) => applicationsController.update(req, res, next));
router.delete('/:id', (req, res, next) => applicationsController.delete(req, res, next));

export { router as applicationsRouter };
