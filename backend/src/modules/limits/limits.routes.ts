import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { limitsController } from './limits.controller';

const router = Router();
router.use(authenticate);

router.get('/', (req, res, next) => limitsController.list(req, res, next));
router.post('/', (req, res, next) => limitsController.create(req, res, next));
router.patch('/:id', (req, res, next) => limitsController.update(req, res, next));
router.delete('/:id', (req, res, next) => limitsController.delete(req, res, next));

export { router as limitsRouter };
