import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';

export class ReportsController {
    async daily(req: Request, res: Response, next: NextFunction) {
        try {
            const date = (req.query.date as string) ?? new Date().toISOString().split('T')[0];
            const userId = req.user!.userId;

            const [usageRecords, studySessions, limits] = await Promise.all([
                prisma.usageRecord.findMany({
                    where: { userId, localDate: date },
                    include: {
                        trackedApplication: {
                            select: { id: true, applicationName: true, packageName: true },
                        },
                    },
                }),
                prisma.studySession.findMany({
                    where: {
                        userId,
                        status: 'COMPLETED',
                        completedAt: {
                            gte: new Date(`${date}T00:00:00.000Z`),
                            lt: new Date(`${date}T23:59:59.999Z`),
                        },
                    },
                }),
                prisma.dailyLimit.findMany({
                    where: { userId },
                    include: {
                        trackedApplication: {
                            select: { id: true, applicationName: true, packageName: true },
                        },
                    },
                }),
            ]);

            const totalUsageSeconds = usageRecords.reduce((s, r) => s + r.usageDurationSeconds, 0);
            const totalStudySeconds = studySessions.reduce((s, r) => s + r.actualDurationSeconds, 0);

            const appBreakdown = usageRecords.map((record) => {
                const limit = limits.find((l) => l.trackedApplicationId === record.trackedApplicationId);
                const limitSeconds = limit ? limit.limitMinutes * 60 : 0;
                return {
                    application: record.trackedApplication,
                    usedSeconds: record.usageDurationSeconds,
                    limitSeconds,
                    remainingSeconds: Math.max(0, limitSeconds - record.usageDurationSeconds),
                    usagePercentage: limitSeconds > 0
                        ? Math.min(100, Math.round((record.usageDurationSeconds / limitSeconds) * 1000) / 10)
                        : 0,
                };
            });

            return res.json({
                success: true,
                message: 'Daily report retrieved',
                data: {
                    date,
                    totalUsageSeconds,
                    totalStudySeconds,
                    productivityScore: totalStudySeconds > 0
                        ? Math.min(100, Math.round((totalStudySeconds / (totalUsageSeconds + totalStudySeconds)) * 100))
                        : 0,
                    sessionsCompleted: studySessions.length,
                    appBreakdown,
                },
            });
        } catch (err) {
            return next(err);
        }
    }

    async weekly(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.userId;
            const endDate = (req.query.endDate as string) ?? new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.parse(endDate) - 6 * 24 * 60 * 60 * 1000)
                .toISOString().split('T')[0];

            const [usageByDay, studyByDay] = await Promise.all([
                prisma.usageRecord.groupBy({
                    by: ['localDate'],
                    where: { userId, localDate: { gte: startDate, lte: endDate } },
                    _sum: { usageDurationSeconds: true },
                    orderBy: { localDate: 'asc' },
                }),
                prisma.studySession.groupBy({
                    by: ['completedAt'],
                    where: {
                        userId,
                        status: 'COMPLETED',
                        completedAt: {
                            gte: new Date(`${startDate}T00:00:00.000Z`),
                            lte: new Date(`${endDate}T23:59:59.999Z`),
                        },
                    },
                    _sum: { actualDurationSeconds: true },
                }),
            ]);

            return res.json({
                success: true,
                message: 'Weekly report retrieved',
                data: {
                    startDate,
                    endDate,
                    dailyUsage: usageByDay.map((d) => ({
                        date: d.localDate,
                        usageSeconds: d._sum.usageDurationSeconds ?? 0,
                    })),
                    totalUsageSeconds: usageByDay.reduce((s, d) => s + (d._sum.usageDurationSeconds ?? 0), 0),
                    totalStudySeconds: studyByDay.reduce((s, d) => s + (d._sum.actualDurationSeconds ?? 0), 0),
                },
            });
        } catch (err) {
            return next(err);
        }
    }

    async monthly(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.userId;
            const now = new Date();
            const year = parseInt(req.query.year as string ?? now.getFullYear().toString());
            const month = parseInt(req.query.month as string ?? (now.getMonth() + 1).toString());
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

            const [usageByDay, topApps] = await Promise.all([
                prisma.usageRecord.groupBy({
                    by: ['localDate'],
                    where: { userId, localDate: { gte: startDate, lte: endDate } },
                    _sum: { usageDurationSeconds: true },
                    orderBy: { localDate: 'asc' },
                }),
                prisma.usageRecord.groupBy({
                    by: ['trackedApplicationId'],
                    where: { userId, localDate: { gte: startDate, lte: endDate } },
                    _sum: { usageDurationSeconds: true },
                    orderBy: { _sum: { usageDurationSeconds: 'desc' } },
                    take: 5,
                }),
            ]);

            const appIds = topApps.map((a) => a.trackedApplicationId);
            const apps = await prisma.trackedApplication.findMany({
                where: { id: { in: appIds } },
                select: { id: true, applicationName: true, packageName: true },
            });

            return res.json({
                success: true,
                message: 'Monthly report retrieved',
                data: {
                    year,
                    month,
                    startDate,
                    endDate,
                    dailyUsage: usageByDay.map((d) => ({
                        date: d.localDate,
                        usageSeconds: d._sum.usageDurationSeconds ?? 0,
                    })),
                    totalUsageSeconds: usageByDay.reduce((s, d) => s + (d._sum.usageDurationSeconds ?? 0), 0),
                    topApplications: topApps.map((a) => ({
                        application: apps.find((app) => app.id === a.trackedApplicationId),
                        totalSeconds: a._sum.usageDurationSeconds ?? 0,
                    })),
                },
            });
        } catch (err) {
            return next(err);
        }
    }
}

export const reportsController = new ReportsController();
