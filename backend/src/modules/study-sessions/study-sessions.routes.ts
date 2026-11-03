import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { studySessionsController } from './study-sessions.controller';

const router = Router();
router.use(authenticate);

router.post('/', (req, res, next) => studySessionsController.create(req, res, next));
router.get('/', (req, res, next) => studySessionsController.list(req, res, next));
router.get('/:id', (req, res, next) => studySessionsController.getById(req, res, next));
router.patch('/:id', (req, res, next) => studySessionsController.update(req, res, next));
router.post('/:id/complete', (req, res, next) => studySessionsController.complete(req, res, next));

export { router as studySessionsRouter };
