import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface EnvConfig {
    NODE_ENV: string;
    PORT: number;
    DATABASE_URL: string;
    JWT_ACCESS_SECRET: string;
    JWT_REFRESH_SECRET: string;
    JWT_ACCESS_EXPIRES_IN: string;
    JWT_REFRESH_EXPIRES_IN: string;
    APP_BASE_URL: string;
    CORS_ORIGIN: string;
    BCRYPT_ROUNDS: number;
    RATE_LIMIT_WINDOW_MS: number;
    RATE_LIMIT_MAX_REQUESTS: number;
}

function getEnv(key: string, fallback?: string): string {
    const value = process.env[key] ?? fallback;
    if (value === undefined) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

export const config: EnvConfig = {
    NODE_ENV: getEnv('NODE_ENV', 'development'),
    PORT: parseInt(getEnv('PORT', '5000'), 10),
    DATABASE_URL: getEnv('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/focusguard'),
    JWT_ACCESS_SECRET: getEnv('JWT_ACCESS_SECRET', 'dev_access_secret_change_in_production_32chars'),
    JWT_REFRESH_SECRET: getEnv('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_in_production_32chars'),
    JWT_ACCESS_EXPIRES_IN: getEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
    JWT_REFRESH_EXPIRES_IN: getEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
    APP_BASE_URL: getEnv('APP_BASE_URL', 'http://localhost:5000'),
    CORS_ORIGIN: getEnv('CORS_ORIGIN', ''),
    BCRYPT_ROUNDS: parseInt(getEnv('BCRYPT_ROUNDS', '12'), 10),
    RATE_LIMIT_WINDOW_MS: parseInt(getEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    RATE_LIMIT_MAX_REQUESTS: parseInt(getEnv('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
};

if (config.NODE_ENV === 'production') {
    if (!/^postgres(ql)?:\/\//i.test(config.DATABASE_URL)) {
        throw new Error('Production DATABASE_URL must use PostgreSQL.');
    }
    if (config.JWT_ACCESS_SECRET.length < 32 || config.JWT_REFRESH_SECRET.length < 32) {
        throw new Error('Production JWT secrets must each be at least 32 characters long.');
    }
    if (config.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean).length === 0) {
        throw new Error('CORS_ORIGIN must contain at least one authorized web origin in production.');
    }
    if (!config.APP_BASE_URL.startsWith('https://')) {
        throw new Error('APP_BASE_URL must use HTTPS in production.');
    }
}
