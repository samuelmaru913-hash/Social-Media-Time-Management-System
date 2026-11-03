import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { config } from '../../config/env';
import { NotFoundError } from '../../middleware/errorHandler';

const UpdateUserSchema = z.object({
    fullName: z.string().min(2).max(100).optional(),
    timeZone: z.string().optional(),
    password: z.string().min(8).optional(),
});

export class UsersController {
    async getMe(req: Request, res: Response, next: NextFunction) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: req.user!.userId },
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    role: true,
                    timeZone: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true,
                    notificationPref: true,
                    userPreferences: true,
                },
            });
            if (!user) throw new NotFoundError('User');
            return res.json({ success: true, message: 'User profile retrieved', data: user });
        } catch (err) {
            return next(err);
        }
    }

    async updateMe(req: Request, res: Response, next: NextFunction) {
        try {
            const dto = UpdateUserSchema.parse(req.body);
            const updateData: Record<string, unknown> = {};
            if (dto.fullName) updateData.fullName = dto.fullName;
            if (dto.timeZone) updateData.timeZone = dto.timeZone;
            if (dto.password) {
                updateData.passwordHash = await bcrypt.hash(dto.password, config.BCRYPT_ROUNDS);
            }
            const user = await prisma.user.update({
                where: { id: req.user!.userId },
                data: updateData,
                select: { id: true, fullName: true, email: true, role: true, timeZone: true, updatedAt: true },
            });
            return res.json({ success: true, message: 'Profile updated', data: user });
        } catch (err) {
            return next(err);
        }
    }

    async deleteMe(req: Request, res: Response, next: NextFunction) {
        try {
            await prisma.user.delete({ where: { id: req.user!.userId } });
            return res.json({ success: true, message: 'Account deleted successfully', data: null });
        } catch (err) {
            return next(err);
        }
    }

    async updatePreferences(req: Request, res: Response, next: NextFunction) {
        try {
            const prefs = await prisma.userPreferences.upsert({
                where: { userId: req.user!.userId },
                create: { userId: req.user!.userId, ...req.body },
                update: req.body,
            });
            return res.json({ success: true, message: 'Preferences updated', data: prefs });
        } catch (err) {
            return next(err);
        }
    }
}

export const usersController = new UsersController();
