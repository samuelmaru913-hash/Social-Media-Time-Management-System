import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { NotFoundError, ForbiddenError } from '../../middleware/errorHandler';
import { getRouteParam } from '../../utils/routeParam';

const CreateLimitSchema = z.object({
    trackedApplicationId: z.string().cuid(),
    limitMinutes: z.number().int().min(1).max(1440).default(180),
    warningThreshold: z.number().int().min(50).max(100).default(80),
    scheduleConfiguration: z.record(z.string(), z.unknown()).nullable().optional(),
    isEnabled: z.boolean().default(true),
});

const UpdateLimitSchema = z.object({
    limitMinutes: z.number().int().min(1).max(1440).optional(),
    warningThreshold: z.number().int().min(50).max(100).optional(),
    scheduleConfiguration: z.record(z.string(), z.unknown()).nullable().optional(),
    isEnabled: z.boolean().optional(),
});

function dbScheduleConfiguration(value: Record<string, unknown> | null | undefined) {
    return value == null ? value : JSON.stringify(value);
}

function apiScheduleConfiguration(value: string | null): object | null {
    if (value === null) return null;
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Stored schedule configuration is invalid.');
    }
    return parsed;
}

function toApiLimit<T extends { scheduleConfiguration: string | null }>(limit: T) {
    return { ...limit, scheduleConfiguration: apiScheduleConfiguration(limit.scheduleConfiguration) };
}

export class LimitsController {
    async list(req: Request, res: Response, next: NextFunction) {
        try {
            const limits = await prisma.dailyLimit.findMany({
                where: { userId: req.user!.userId },
                include: {
                    trackedApplication: {
                        select: { id: true, applicationName: true, packageName: true, isEnabled: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
            return res.json({ success: true, message: 'Limits retrieved', data: limits.map(toApiLimit) });
        } catch (err) {
            return next(err);
        }
    }

    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const dto = CreateLimitSchema.parse(req.body);
            // Verify application ownership
            const app = await prisma.trackedApplication.findUnique({
                where: { id: dto.trackedApplicationId },
            });
            if (!app) throw new NotFoundError('Application');
            if (app.userId !== req.user!.userId) throw new ForbiddenError();

            const limit = await prisma.dailyLimit.upsert({
                where: {
                    userId_trackedApplicationId: {
                        userId: req.user!.userId,
                        trackedApplicationId: dto.trackedApplicationId,
                    },
                },
                create: {
                    ...dto,
                    scheduleConfiguration: dbScheduleConfiguration(dto.scheduleConfiguration),
                    userId: req.user!.userId,
                },
                update: {
                    ...dto,
                    scheduleConfiguration: dto.scheduleConfiguration === undefined
                        ? undefined
                        : dbScheduleConfiguration(dto.scheduleConfiguration),
                },
            });
            return res.status(201).json({ success: true, message: 'Limit configured', data: toApiLimit(limit) });
        } catch (err) {
            return next(err);
        }
    }

    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getRouteParam(req.params.id);
            const dto = UpdateLimitSchema.parse(req.body);
            const existing = await prisma.dailyLimit.findUnique({ where: { id } });
            if (!existing) throw new NotFoundError('Limit');
            if (existing.userId !== req.user!.userId) throw new ForbiddenError();
            const limit = await prisma.dailyLimit.update({
                where: { id },
                data: {
                    ...dto,
                    scheduleConfiguration: dto.scheduleConfiguration === undefined
                        ? undefined
                        : dbScheduleConfiguration(dto.scheduleConfiguration),
                },
            });
            return res.json({ success: true, message: 'Limit updated', data: toApiLimit(limit) });
        } catch (err) {
            return next(err);
        }
    }

    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getRouteParam(req.params.id);
            const existing = await prisma.dailyLimit.findUnique({ where: { id } });
            if (!existing) throw new NotFoundError('Limit');
            if (existing.userId !== req.user!.userId) throw new ForbiddenError();
            await prisma.dailyLimit.delete({ where: { id } });
            return res.json({ success: true, message: 'Limit removed', data: null });
        } catch (err) {
            return next(err);
        }
    }
}

export const limitsController = new LimitsController();
