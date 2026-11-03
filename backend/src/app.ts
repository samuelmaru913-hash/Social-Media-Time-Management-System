import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { prisma } from './config/database';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';

// Route imports
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { applicationsRouter } from './modules/applications/applications.routes';
import { limitsRouter } from './modules/limits/limits.routes';
import { usageRouter } from './modules/usage/usage.routes';
import { studySessionsRouter } from './modules/study-sessions/study-sessions.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { adminRouter } from './modules/admin/admin.routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(
    cors({
        origin: (origin, callback) => {
            if (config.NODE_ENV !== 'production' || !origin) {
                callback(null, true);
                return;
            }

            const allowedOrigins = config.CORS_ORIGIN
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean);
            callback(null, allowedOrigins.includes(origin));
        },
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    })
);

// Rate limiting
const limiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later' },
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { success: false, message: 'Too many authentication attempts, please try again later' },
});

app.use('/api/v1/auth', authLimiter);
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (config.NODE_ENV !== 'test') {
    app.use(
        morgan('combined', {
            stream: { write: (message: string) => logger.http(message.trim()) },
        })
    );
}

// Read-only health probe; it never exposes database connection details.
app.get('/api/v1/health', async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({
            success: true,
            message: 'Focus No API is running',
            database: 'connected',
        });
    } catch (error) {
        logger.warn('Health check database probe failed', {
            errorType: error instanceof Error ? error.name : 'UnknownError',
        });
        res.status(503).json({
            success: false,
            message: 'Focus No API is running',
            database: 'unavailable',
        });
    }
});

// API Documentation stub
app.get('/api/v1/docs', (_req, res) => {
    res.json({
        success: true,
        message: 'FocusGuard API Documentation',
        data: {
            version: '1.0.0',
            baseUrl: `${config.APP_BASE_URL}/api/v1`,
            endpoints: {
                auth: [
                    'POST /auth/register',
                    'POST /auth/login',
                    'POST /auth/refresh',
                    'POST /auth/logout',
                    'POST /auth/forgot-password',
                    'POST /auth/reset-password',
                ],
                users: ['GET /users/me', 'PATCH /users/me', 'DELETE /users/me', 'PATCH /users/me/preferences'],
                applications: [
                    'GET /applications',
                    'POST /applications',
                    'PATCH /applications/:id',
                    'DELETE /applications/:id',
                ],
                limits: ['GET /limits', 'POST /limits', 'PATCH /limits/:id', 'DELETE /limits/:id'],
                usage: ['GET /usage/today', 'GET /usage/history', 'POST /usage/sync', 'GET /usage/summary'],
                studySessions: [
                    'POST /study-sessions',
                    'GET /study-sessions',
                    'GET /study-sessions/:id',
                    'PATCH /study-sessions/:id',
                    'POST /study-sessions/:id/complete',
                ],
                reports: ['GET /reports/daily', 'GET /reports/weekly', 'GET /reports/monthly'],
                notifications: ['GET /notifications/preferences', 'PATCH /notifications/preferences'],
            },
        },
    });
});

// API routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/applications', applicationsRouter);
app.use('/api/v1/limits', limitsRouter);
app.use('/api/v1/usage', usageRouter);
app.use('/api/v1/study-sessions', studySessionsRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/admin', adminRouter);

// 404 handler
app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Error handler (must be last)
app.use(errorHandler);

export { app };
