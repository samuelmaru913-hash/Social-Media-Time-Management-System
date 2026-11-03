import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../config/database';
import { config } from '../../config/env';
import { AppError, ConflictError, UnauthorizedError } from '../../middleware/errorHandler';
import { JwtPayload } from '../../middleware/auth';
import { RegisterDto, LoginDto } from './auth.schema';
import { logger } from '../../utils/logger';

export class AuthService {
    async register(dto: RegisterDto) {
        const existing = await prisma.user.findUnique({ where: { email: dto.email } });
        if (existing) {
            throw new ConflictError('An account with this email already exists');
        }

        const passwordHash = await bcrypt.hash(dto.password, config.BCRYPT_ROUNDS);

        const user = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    fullName: dto.fullName,
                    email: dto.email,
                    passwordHash,
                    timeZone: dto.timeZone,
                },
                select: { id: true, fullName: true, email: true, role: true, timeZone: true, createdAt: true },
            });

            await tx.notificationPreference.create({
                data: { userId: newUser.id },
            });

            await tx.userPreferences.create({
                data: { userId: newUser.id },
            });

            return newUser;
        });

        const tokens = await this.generateTokenPair(user.id, user.email, user.role);
        logger.info('User registered', { userId: user.id });
        return { user, ...tokens };
    }

    async login(dto: LoginDto) {
        const user = await prisma.user.findUnique({
            where: { email: dto.email },
            select: {
                id: true,
                fullName: true,
                email: true,
                passwordHash: true,
                role: true,
                timeZone: true,
                isActive: true,
                createdAt: true,
            },
        });

        if (!user) {
            throw new UnauthorizedError('Invalid email or password');
        }

        if (!user.isActive) {
            throw new UnauthorizedError('Account is inactive');
        }

        const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!passwordValid) {
            throw new UnauthorizedError('Invalid email or password');
        }

        const tokens = await this.generateTokenPair(user.id, user.email, user.role);
        const { passwordHash: _, ...safeUser } = user;
        logger.info('User logged in', { userId: user.id });
        return { user: safeUser, ...tokens };
    }

    async refresh(tokenString: string) {
        let payload: JwtPayload;
        try {
            payload = jwt.verify(tokenString, config.JWT_REFRESH_SECRET) as JwtPayload;
        } catch {
            throw new UnauthorizedError('Invalid or expired refresh token');
        }

        const tokenHash = crypto.createHash('sha256').update(tokenString).digest('hex');
        const session = await prisma.refreshTokenSession.findUnique({
            where: { tokenHash },
            include: { user: { select: { id: true, email: true, role: true, isActive: true } } },
        });

        if (!session || session.revokedAt || session.expiresAt < new Date()) {
            throw new UnauthorizedError('Refresh token is invalid or has been revoked');
        }

        if (!session.user.isActive) {
            throw new UnauthorizedError('Account is inactive');
        }

        // Rotate: revoke old, issue new
        await prisma.refreshTokenSession.update({
            where: { id: session.id },
            data: { revokedAt: new Date() },
        });

        const tokens = await this.generateTokenPair(
            session.user.id,
            session.user.email,
            session.user.role
        );
        return tokens;
    }

    async logout(tokenString: string) {
        const tokenHash = crypto.createHash('sha256').update(tokenString).digest('hex');
        await prisma.refreshTokenSession
            .update({
                where: { tokenHash },
                data: { revokedAt: new Date() },
            })
            .catch(() => {
                // Token not found — already logged out or invalid; ignore
            });
    }

    async logoutAll(userId: string) {
        await prisma.refreshTokenSession.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }

    private async generateTokenPair(userId: string, email: string, role: string) {
        const jwtPayload: JwtPayload = { userId, email, role };

        const accessToken = jwt.sign(jwtPayload, config.JWT_ACCESS_SECRET, {
            expiresIn: config.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
        });

        const refreshToken = jwt.sign(jwtPayload, config.JWT_REFRESH_SECRET, {
            expiresIn: config.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
        });

        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await prisma.refreshTokenSession.create({
            data: { userId, tokenHash, expiresAt },
        });

        return { accessToken, refreshToken };
    }
}

export const authService = new AuthService();
