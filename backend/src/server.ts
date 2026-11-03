import { app } from './app';
import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './utils/logger';

async function startServer() {
    try {
        await connectDatabase();
        const server = app.listen(config.PORT, '0.0.0.0', () => {
            logger.info(`Focus No API server started`, {
                port: config.PORT,
                environment: config.NODE_ENV,
                host: '0.0.0.0',
                basePath: '/api/v1',
            });
        });

        // Graceful shutdown
        const shutdown = async (signal: string) => {
            logger.info(`Received ${signal}, shutting down gracefully`);
            server.close(async () => {
                await disconnectDatabase();
                logger.info('Server closed');
                process.exit(0);
            });

            setTimeout(() => {
                logger.error('Forced shutdown after timeout');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('uncaughtException', (err) => {
            logger.error('Uncaught exception', { error: err.message, stack: err.stack });
            process.exit(1);
        });
        process.on('unhandledRejection', (reason) => {
            logger.error('Unhandled promise rejection', { reason });
            process.exit(1);
        });
    } catch (err) {
        logger.error('Failed to start server', { error: err });
        process.exit(1);
    }
}

startServer();
