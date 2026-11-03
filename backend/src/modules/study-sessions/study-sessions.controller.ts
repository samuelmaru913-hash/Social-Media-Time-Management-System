import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { NotFoundError, ForbiddenError } from '../../middleware/errorHandler';
import { getRouteParam } from '../../utils/routeParam';

const CreateSessionSchema = z.object({
    title: z.string().min(1).max(200).default('Study Session'),
    plannedDurationMinutes: z.number().int().min(1).max(480).default(25),
    notes: z.string().max(1000).optional(),
});

const UpdateSessionSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    actualDurationSeconds: z.number().int().min(0).optional(),
    status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional(),
    notes: z.string().max(1000).optional().nullable(),
});

export class StudySessionsController {
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const dto = CreateSessionSchema.parse(req.body);
            const session = await prisma.studySession.create({
                data: {
                    ...dto,
                    userId: req.user!.userId,
                    startedAt: new Date(),
                    status: 'ACTIVE',
                },
            });
            return res.status(201).json({ success: true, message: 'Study session started', data: session });
        } catch (err) {
            return next(err);
        }
    }

    async list(req: Request, res: Response, next: NextFunction) {
        try {
            const page = parseInt(req.query.page as string ?? '1');
            const limit = parseInt(req.query.limit as string ?? '20');
            const [sessions, total] = await Promise.all([
                prisma.studySession.findMany({
                    where: { userId: req.user!.userId },
                    orderBy: { createdAt: 'desc' },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma.studySession.count({ where: { userId: req.user!.userId } }),
            ]);
            return res.json({
                success: true,
                message: 'Study sessions retrieved',
                data: sessions,
                meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
            });
        } catch (err) {
            return next(err);
        }
    }

    async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getRouteParam(req.params.id);
            const session = await prisma.studySession.findUnique({ where: { id } });
            if (!session) throw new NotFoundError('Study session');
            if (session.userId !== req.user!.userId) throw new ForbiddenError();
            return res.json({ success: true, message: 'Study session retrieved', data: session });
        } catch (err) {
            return next(err);
        }
    }

    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getRouteParam(req.params.id);
            const dto = UpdateSessionSchema.parse(req.body);
            const existing = await prisma.studySession.findUnique({ where: { id } });
            if (!existing) throw new NotFoundError('Study session');
            if (existing.userId !== req.user!.userId) throw new ForbiddenError();
            const session = await prisma.studySession.update({ where: { id }, data: dto });
            return res.json({ success: true, message: 'Study session updated', data: session });
        } catch (err) {
            return next(err);
        }
    }

    async complete(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getRouteParam(req.params.id);
            const existing = await prisma.studySession.findUnique({ where: { id } });
            if (!existing) throw new NotFoundError('Study session');
            if (existing.userId !== req.user!.userId) throw new ForbiddenError();

            const startedAt = existing.startedAt ?? new Date();
            const actualDurationSeconds =
                req.body.actualDurationSeconds ??
                Math.floor((Date.now() - startedAt.getTime()) / 1000);

            const session = await prisma.studySession.update({
                where: { id },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    actualDurationSeconds,
                },
            });
            return res.json({ success: true, message: 'Study session completed', data: session });
        } catch (err) {
            return next(err);
        }
    }
}

export const studySessionsController = new StudySessionsController();
