import { z } from 'zod';

export const registerSchema = z
    .object({
        fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
        email: z.string().email('Please enter a valid email address'),
        password: z
            .string()
            .min(8, 'Password must be at least 8 characters')
            .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
            .regex(/[0-9]/, 'Must contain at least one number'),
        confirmPassword: z.string(),
        agreed: z.boolean().refine((v) => v === true, 'You must accept the terms'),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });

export const loginSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
});

export const limitSchema = z.object({
    limitMinutes: z
        .number({ error: 'Must be a number' })
        .int()
        .min(1, 'Minimum 1 minute')
        .max(1440, 'Maximum 24 hours'),
    warningThreshold: z.number().int().min(50).max(100).default(80),
});

export const studySessionSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200),
    plannedDurationMinutes: z
        .number()
        .int()
        .min(1, 'Minimum 1 minute')
        .max(480, 'Maximum 8 hours'),
    notes: z.string().max(1000).optional(),
});

export type RegisterFormData = z.infer<typeof registerSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type LimitFormData = z.infer<typeof limitSchema>;
export type StudySessionFormData = z.infer<typeof studySessionSchema>;
