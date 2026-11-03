import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { prisma } from '../config/database';
import { UnauthorizedError, ForbiddenError } from './errorHandler';

export interface JwtPayload {
    userId: string;
    email: string;
    role: string;
    iat?: number;
    exp?: number;
}

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return next(new UnauthorizedError('No authorization token provided'));
    }

    const token = authHeader.substring(7);
    try {
        const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as JwtPayload;
        req.user = payload;
        return next();
    } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            return next(new UnauthorizedError('Access token expired'));
        }
        return next(new UnauthorizedError('Invalid access token'));
    }
}

export function requireRole(...roles: string[]) {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(new UnauthorizedError());
        }
        if (!roles.includes(req.user.role)) {
            return next(new ForbiddenError('Insufficient permissions'));
        }
        return next();
    };
}

export async function requireActiveUser(req: Request, _res: Response, next: NextFunction) {
    if (!req.user) {
        return next(new UnauthorizedError());
    }
    const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { isActive: true },
    });
    if (!user?.isActive) {
        return next(new UnauthorizedError('Account is inactive'));
    }
    return next();
}
