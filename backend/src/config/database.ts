import { Prisma, PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

type PrismaEventLogLevel = 'query' | 'error' | 'warn';
type AppPrismaClient = PrismaClient<Prisma.PrismaClientOptions, PrismaEventLogLevel>;

declare global {
    // eslint-disable-next-line no-var
    var __prisma: AppPrismaClient | undefined;
}

const createPrismaClient = (): AppPrismaClient =>
    new PrismaClient<Prisma.PrismaClientOptions, PrismaEventLogLevel>({
        log: [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
        ],
    });

export const prisma = global.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
    global.__prisma = prisma;
}

prisma.$on('error', (e) => {
    logger.error('Prisma error', { message: e.message, target: e.target });
});

prisma.$on('warn', (e) => {
    logger.warn('Prisma warning', { message: e.message, target: e.target });
});

export async function connectDatabase(): Promise<void> {
    await prisma.$connect();
    logger.info('Database connected successfully');
}

export async function disconnectDatabase(): Promise<void> {
    await prisma.$disconnect();
    logger.info('Database disconnected');
}
