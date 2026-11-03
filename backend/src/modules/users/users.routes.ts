import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { usersController } from './users.controller';

const router = Router();
router.use(authenticate);

router.get('/me', (req, res, next) => usersController.getMe(req, res, next));
router.patch('/me', (req, res, next) => usersController.updateMe(req, res, next));
router.delete('/me', (req, res, next) => usersController.deleteMe(req, res, next));
router.patch('/me/preferences', (req, res, next) => usersController.updatePreferences(req, res, next));

export { router as usersRouter };
