import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { adminController } from './admin.controller';

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(authenticate);
router.use(requireRole('ADMIN'));

// List all student users
router.get('/users', (req, res, next) => adminController.listUsers(req, res, next));

// Get all apps registered by a specific user
router.get('/users/:userId/applications', (req, res, next) =>
    adminController.getUserApplications(req, res, next)
);

// Update app enabled/monitoring status
router.patch('/users/:userId/applications/:appId', (req, res, next) =>
    adminController.updateUserApp(req, res, next)
);

// Set/update daily time limit for a user's app
router.patch('/users/:userId/applications/:appId/limit', (req, res, next) =>
    adminController.setUserAppLimit(req, res, next)
);

export { router as adminRouter };
