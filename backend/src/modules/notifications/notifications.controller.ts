import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';

const UpdatePreferencesSchema = z.object({
    limitWarningsEnabled: z.boolean().optional(),
    studyRemindersEnabled: z.boolean().optional(),
    dailySummaryEnabled: z.boolean().optional(),
    resetReminderEnabled: z.boolean().optional(),
    warningThresholds: z.array(z.number().int().min(1).max(100)).optional(),
});

function dbPreferences(dto: z.infer<typeof UpdatePreferencesSchema>) {
    const { warningThresholds, ...fields } = dto;
    return {
        ...fields,
        ...(warningThresholds === undefined
            ? {}
            : { warningThresholds: JSON.stringify(warningThresholds) }),
    };
}

function toApiPreferences<T extends { warningThresholds: string }>(preferences: T) {
    return {
        ...preferences,
        warningThresholds: z
            .array(z.number().int().min(1).max(100))
            .parse(JSON.parse(preferences.warningThresholds) as unknown),
    };
}

export class NotificationsController {
    async getPreferences(req: Request, res: Response, next: NextFunction) {
        try {
            const prefs = await prisma.notificationPreference.upsert({
                where: { userId: req.user!.userId },
                create: { userId: req.user!.userId },
                update: {},
            });
            return res.json({
                success: true,
                message: 'Notification preferences retrieved',
                data: toApiPreferences(prefs),
            });
        } catch (err) {
            return next(err);
        }
    }

    async updatePreferences(req: Request, res: Response, next: NextFunction) {
        try {
            const dto = UpdatePreferencesSchema.parse(req.body);
            const prefs = await prisma.notificationPreference.upsert({
                where: { userId: req.user!.userId },
                create: { userId: req.user!.userId, ...dbPreferences(dto) },
                update: dbPreferences(dto),
            });
            return res.json({
                success: true,
                message: 'Notification preferences updated',
                data: toApiPreferences(prefs),
            });
        } catch (err) {
            return next(err);
        }
    }
}

export const notificationsController = new NotificationsController();
