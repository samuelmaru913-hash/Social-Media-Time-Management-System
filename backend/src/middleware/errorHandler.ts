import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    public readonly errors: Record<string, string[]>;
    constructor(errors: Record<string, string[]>) {
        super('Validation failed', 422);
        this.errors = errors;
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401);
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(message, 403);
    }
}

export class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404);
    }
}

export class ConflictError extends AppError {
    constructor(message = 'Resource already exists') {
        super(message, 409);
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
    if (err instanceof ZodError) {
        const errors: Record<string, string[]> = {};
        err.issues.forEach((e) => {
            const key = e.path.join('.');
            errors[key] = errors[key] ?? [];
            errors[key].push(e.message);
        });
        return res.status(422).json({
            success: false,
            message: 'Validation failed',
            errors,
        });
    }

    if (err instanceof ValidationError) {
        return res.status(422).json({
            success: false,
            message: err.message,
            errors: err.errors,
        });
    }

    if (err instanceof AppError) {
        if (!err.isOperational) {
            logger.error('Unexpected AppError', { error: err.message, stack: err.stack });
        }
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
        });
    }

    // Prisma error handling
    if (err.name === 'PrismaClientKnownRequestError') {
        const prismaErr = err as NodeJS.ErrnoException & { code: string; meta?: Record<string, unknown> };
        if (prismaErr.code === 'P2002') {
            return res.status(409).json({
                success: false,
                message: 'A record with this information already exists',
            });
        }
        if (prismaErr.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'Record not found',
            });
        }
    }

    logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });

    return res.status(500).json({
        success: false,
        message: 'An internal server error occurred',
    });
}
