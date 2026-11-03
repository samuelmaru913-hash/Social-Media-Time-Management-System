import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';

const SyncRecordSchema = z.object({
    trackedApplicationId: z.string().cuid(),
    localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
    timeZone: z.string(),
    usageDurationSeconds: z.number().int().min(0),
    sourceDeviceId: z.string().optional(),
    syncId: z.string().uuid('syncId must be a UUID'),
});

const SyncSchema = z.object({
    records: z.array(SyncRecordSchema).min(1).max(500),
});

const HistoryQuerySchema = z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    packageName: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export class UsageController {
    async getToday(req: Request, res: Response, next: NextFunction) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const records = await prisma.usageRecord.findMany({
                where: { userId: req.user!.userId, localDate: today },
                include: {
                    trackedApplication: {
                        select: { id: true, applicationName: true, packageName: true },
                    },
                },
            });

            const limits = await prisma.dailyLimit.findMany({
                where: { userId: req.user!.userId },
                include: {
                    trackedApplication: {
                        select: { id: true, applicationName: true, packageName: true },
                    },
                },
            });

            const usageSummary = limits.map((limit) => {
                const record = records.find(
                    (r) => r.trackedApplicationId === limit.trackedApplicationId
                );
                const usedSeconds = record?.usageDurationSeconds ?? 0;
                const limitSeconds = limit.limitMinutes * 60;
                const remainingSeconds = Math.max(0, limitSeconds - usedSeconds);
                const usagePercentage =
                    limitSeconds > 0 ? Math.min(100, (usedSeconds / limitSeconds) * 100) : 0;

                return {
                    application: limit.trackedApplication,
                    limitMinutes: limit.limitMinutes,
                    usedSeconds,
                    remainingSeconds,
                    usagePercentage: Math.round(usagePercentage * 10) / 10,
                    isLimitReached: usedSeconds >= limitSeconds,
                    isWarningTriggered: usagePercentage >= limit.warningThreshold,
                };
            });

            return res.json({
                success: true,
                message: 'Today\'s usage retrieved',
                data: { date: today, usage: usageSummary },
            });
        } catch (err) {
            return next(err);
        }
    }

    async getHistory(req: Request, res: Response, next: NextFunction) {
        try {
            const { startDate, endDate, page, limit } = HistoryQuerySchema.parse(req.query);
            const where: Record<string, unknown> = { userId: req.user!.userId };
            if (startDate || endDate) {
                const dateFilter: Record<string, string> = {};
                if (startDate) dateFilter.gte = startDate;
                if (endDate) dateFilter.lte = endDate;
                where.localDate = dateFilter;
            }

            const [records, total] = await Promise.all([
                prisma.usageRecord.findMany({
                    where,
                    include: {
                        trackedApplication: {
                            select: { id: true, applicationName: true, packageName: true },
                        },
                    },
                    orderBy: { localDate: 'desc' },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma.usageRecord.count({ where }),
            ]);

            return res.json({
                success: true,
                message: 'Usage history retrieved',
                data: records,
                meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
            });
        } catch (err) {
            return next(err);
        }
    }

    async sync(req: Request, res: Response, next: NextFunction) {
        try {
            const { records } = SyncSchema.parse(req.body);
            const userId = req.user!.userId;

            const results = await Promise.allSettled(
                records.map(async (record) => {
                    // Verify application ownership
                    const app = await prisma.trackedApplication.findFirst({
                        where: { id: record.trackedApplicationId, userId },
                    });
                    if (!app) return { syncId: record.syncId, status: 'skipped', reason: 'Application not found' };

                    // Deduplication by syncId
                    const existing = await prisma.usageRecord.findUnique({
                        where: { syncId: record.syncId },
                    });
                    if (existing) {
                        return { syncId: record.syncId, status: 'duplicate' };
                    }

                    await prisma.usageRecord.upsert({
                        where: {
                            userId_trackedApplicationId_localDate_sourceDeviceId: {
                                userId,
                                trackedApplicationId: record.trackedApplicationId,
                                localDate: record.localDate,
                                sourceDeviceId: record.sourceDeviceId ?? 'unknown',
                            },
                        },
                        create: { ...record, userId, sourceDeviceId: record.sourceDeviceId ?? 'unknown' },
                        update: {
                            usageDurationSeconds: {
                                set: Math.max(
                                    (
                                        await prisma.usageRecord.findFirst({
                                            where: {
                                                userId,
                                                trackedApplicationId: record.trackedApplicationId,
                                                localDate: record.localDate,
                                                sourceDeviceId: record.sourceDeviceId ?? 'unknown',
                                            },
                                            select: { usageDurationSeconds: true },
                                        })
                                    )?.usageDurationSeconds ?? 0,
                                    record.usageDurationSeconds
                                ),
                            },
                            syncId: record.syncId,
                            timeZone: record.timeZone,
                        },
                    });

                    return { syncId: record.syncId, status: 'synced' };
                })
            );

            const summary = {
                synced: results.filter((r) => r.status === 'fulfilled' && (r.value as Record<string, string>).status === 'synced').length,
                duplicate: results.filter((r) => r.status === 'fulfilled' && (r.value as Record<string, string>).status === 'duplicate').length,
                skipped: results.filter((r) => r.status === 'fulfilled' && (r.value as Record<string, string>).status === 'skipped').length,
                failed: results.filter((r) => r.status === 'rejected').length,
            };

            logger.info('Usage sync completed', { userId, ...summary });
            return res.json({
                success: true,
                message: `Usage synchronized: ${summary.synced} records saved`,
                data: { summary, results: results.map((r) => (r.status === 'fulfilled' ? r.value : { status: 'failed' })) },
            });
        } catch (err) {
            return next(err);
        }
    }

    async getSummary(req: Request, res: Response, next: NextFunction) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const weeklyRecords = await prisma.usageRecord.groupBy({
                by: ['localDate'],
                where: { userId: req.user!.userId, localDate: { gte: weekAgo, lte: today } },
                _sum: { usageDurationSeconds: true },
                orderBy: { localDate: 'asc' },
            });

            const totalToday = await prisma.usageRecord.aggregate({
                where: { userId: req.user!.userId, localDate: today },
                _sum: { usageDurationSeconds: true },
            });

            return res.json({
                success: true,
                message: 'Usage summary retrieved',
                data: {
                    todaySeconds: totalToday._sum.usageDurationSeconds ?? 0,
                    weeklyBreakdown: weeklyRecords.map((r) => ({
                        date: r.localDate,
                        usageSeconds: r._sum.usageDurationSeconds ?? 0,
                    })),
                },
            });
        } catch (err) {
            return next(err);
        }
    }
}

export const usageController = new UsageController();
