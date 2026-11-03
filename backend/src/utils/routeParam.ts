import { AppError } from '../middleware/errorHandler';

export function getRouteParam(value: string | string[] | undefined): string {
    if (typeof value === 'string' && value.length > 0) return value;
    if (Array.isArray(value) && value.length === 1 && value[0]) return value[0];
    throw new AppError('Invalid route parameter', 400);
}
