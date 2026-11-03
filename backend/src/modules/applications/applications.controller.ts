import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { NotFoundError, ForbiddenError } from '../../middleware/errorHandler';
import { getRouteParam } from '../../utils/routeParam';

const CreateAppSchema = z.object({
    applicationName: z.string().min(1).max(100),
    packageName: z.string().min(1).max(200),
    iconUrl: z.string().url().optional(),
    isEnabled: z.boolean().default(true),
    deviceId: z.string().optional(),
    monitoringStatus: z.enum(['ACTIVE', 'PAUSED', 'REMOVED']).default('ACTIVE'),
});

const UpdateAppSchema = z.object({
    applicationName: z.string().min(1).max(100).optional(),
    isEnabled: z.boolean().optional(),
    iconUrl: z.string().url().optional().nullable(),
});

export class ApplicationsController {
    async list(req: Request, res: Response, next: NextFunction) {
        try {
            const apps = await prisma.trackedApplication.findMany({
                where: { userId: req.user!.userId },
                include: {
                    dailyLimits: {
                        select: { limitMinutes: true, warningThreshold: true, isEnabled: true },
                    },
                },
                orderBy: { applicationName: 'asc' },
            });
            return res.json({ success: true, message: 'Applications retrieved', data: apps });
        } catch (err) {
            return next(err);
        }
    }

    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const dto = CreateAppSchema.parse(req.body);
            const app = await prisma.trackedApplication.create({
                data: { ...dto, userId: req.user!.userId },
            });
            return res.status(201).json({ success: true, message: 'Application added', data: app });
        } catch (err) {
            return next(err);
        }
    }

    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getRouteParam(req.params.id);
            const dto = UpdateAppSchema.parse(req.body);
            const existing = await prisma.trackedApplication.findUnique({ where: { id } });
            if (!existing) throw new NotFoundError('Application');
            if (existing.userId !== req.user!.userId) throw new ForbiddenError();
            const app = await prisma.trackedApplication.update({ where: { id }, data: dto });
            return res.json({ success: true, message: 'Application updated', data: app });
        } catch (err) {
            return next(err);
        }
    }

    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getRouteParam(req.params.id);
            const existing = await prisma.trackedApplication.findUnique({ where: { id } });
            if (!existing) throw new NotFoundError('Application');
            if (existing.userId !== req.user!.userId) throw new ForbiddenError();
            await prisma.trackedApplication.delete({ where: { id } });
            return res.json({ success: true, message: 'Application removed', data: null });
        } catch (err) {
            return next(err);
        }
    }
}

export const applicationsController = new ApplicationsController();
