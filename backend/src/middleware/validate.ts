import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validateBody(schema: ZodSchema) {
    return (req: Request, _res: Response, next: NextFunction) => {
        schema.parse(req.body);
        next();
    };
}

export function validateQuery(schema: ZodSchema) {
    return (req: Request, _res: Response, next: NextFunction) => {
        const parsed = schema.parse(req.query);
        req.query = parsed as typeof req.query;
        next();
    };
}

export function validateParams(schema: ZodSchema) {
    return (req: Request, _res: Response, next: NextFunction) => {
        schema.parse(req.params);
        next();
    };
}
