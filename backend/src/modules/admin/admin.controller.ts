import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { NotFoundError, ForbiddenError } from '../../middleware/errorHandler';
import { getRouteParam } from '../../utils/routeParam';

const UpdateLimitSchema = z.object({
    limitMinutes: z.number().int().min(1).max(1440).optional(),
    warningThreshold: z.number().int().min(50).max(100).optional(),
    isEnabled: z.boolean().optional(),
});

const UpdateAppSchema = z.object({
    isEnabled: z.boolean().optional(),
    monitoringStatus: z.enum(['ACTIVE', 'PAUSED', 'REMOVED']).optional(),
});

export class AdminController {
    /**
     * GET /admin/users
     * List all non-admin users with their tracked app count.
     */
    async listUsers(req: Request, res: Response, next: NextFunction) {
        try {
            const users = await prisma.user.findMany({
                where: { role: 'STUDENT' },
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    isActive: true,
                    createdAt: true,
                    _count: {
                        select: { trackedApplications: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            return res.json({
                success: true,
                message: 'Users retrieved',
                data: users.map((u) => ({
                    ...u,
                    trackedAppCount: u._count.trackedApplications,
                })),
            });
        } catch (err) {
            return next(err);
        }
    }

    /**
     * GET /admin/users/:userId/applications
     * Get all apps registered by a specific user, including limits and today's usage.
     */
    async getUserApplications(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getRouteParam(req.params.userId);

            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, fullName: true, email: true },
            });
            if (!user) throw new NotFoundError('User');

            const today = new Date().toISOString().split('T')[0];

            const apps = await prisma.trackedApplication.findMany({
                where: { userId },
                include: {
                    dailyLimits: {
                        select: {
                            id: true,
                            limitMinutes: true,
                            warningThreshold: true,
                            isEnabled: true,
                        },
                    },
                    usageRecords: {
                        where: { localDate: today },
                        select: { usageDurationSeconds: true },
                    },
                },
                orderBy: { applicationName: 'asc' },
            });

            const data = apps.map((app) => {
                const limit = app.dailyLimits[0];
                const usedSeconds = app.usageRecords.reduce(
                    (sum, r) => sum + r.usageDurationSeconds,
                    0
                );
                const limitSeconds = limit ? limit.limitMinutes * 60 : null;
                const remainingSeconds =
                    limitSeconds !== null
                        ? Math.max(0, limitSeconds - usedSeconds)
                        : null;

                return {
                    id: app.id,
                    applicationName: app.applicationName,
                    packageName: app.packageName,
                    isEnabled: app.isEnabled,
                    monitoringStatus: app.monitoringStatus,
                    iconUrl: app.iconUrl,
                    deviceId: app.deviceId,
                    createdAt: app.createdAt,
                    limit: limit ?? null,
                    usedSeconds,
                    limitSeconds,
                    remainingSeconds,
                };
            });

            return res.json({
                success: true,
                message: 'User applications retrieved',
                data: { user, applications: data },
            });
        } catch (err) {
            return next(err);
        }
    }

    /**
     * PATCH /admin/users/:userId/applications/:appId
     * Enable/disable monitoring or change monitoring status for a user's app.
     */
    async updateUserApp(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getRouteParam(req.params.userId);
            const appId = getRouteParam(req.params.appId);
            const dto = UpdateAppSchema.parse(req.body);

            const app = await prisma.trackedApplication.findUnique({
                where: { id: appId },
            });
            if (!app) throw new NotFoundError('Application');
            if (app.userId !== userId) throw new ForbiddenError();

            const updated = await prisma.trackedApplication.update({
                where: { id: appId },
                data: dto,
            });

            return res.json({
                success: true,
                message: 'Application updated',
                data: updated,
            });
        } catch (err) {
            return next(err);
        }
    }

    /**
     * PATCH /admin/users/:userId/applications/:appId/limit
     * Set or update the daily time limit for a user's specific app.
     */
    async setUserAppLimit(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getRouteParam(req.params.userId);
            const appId = getRouteParam(req.params.appId);
            const dto = UpdateLimitSchema.parse(req.body);

            // Verify app belongs to user
            const app = await prisma.trackedApplication.findUnique({
                where: { id: appId },
            });
            if (!app) throw new NotFoundError('Application');
            if (app.userId !== userId) throw new ForbiddenError();

            const limit = await prisma.dailyLimit.upsert({
                where: {
                    userId_trackedApplicationId: {
                        userId,
                        trackedApplicationId: appId,
                    },
                },
                create: {
                    userId,
                    trackedApplicationId: appId,
                    limitMinutes: dto.limitMinutes ?? 60,
                    warningThreshold: dto.warningThreshold ?? 80,
                    isEnabled: dto.isEnabled ?? true,
                },
                update: dto,
            });

            return res.json({
                success: true,
                message: 'Limit updated',
                data: limit,
            });
        } catch (err) {
            return next(err);
        }
    }
}

export const adminController = new AdminController();
