import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from './auth.schema';

export class AuthController {
    async register(req: Request, res: Response, next: NextFunction) {
        try {
            const dto = RegisterSchema.parse(req.body);
            const result = await authService.register(dto);
            return res.status(201).json({
                success: true,
                message: 'Account created successfully',
                data: result,
            });
        } catch (err) {
            return next(err);
        }
    }

    async login(req: Request, res: Response, next: NextFunction) {
        try {
            const dto = LoginSchema.parse(req.body);
            const result = await authService.login(dto);
            return res.status(200).json({
                success: true,
                message: 'Logged in successfully',
                data: result,
            });
        } catch (err) {
            return next(err);
        }
    }

    async refresh(req: Request, res: Response, next: NextFunction) {
        try {
            const { refreshToken } = RefreshTokenSchema.parse(req.body);
            const tokens = await authService.refresh(refreshToken);
            return res.status(200).json({
                success: true,
                message: 'Tokens refreshed successfully',
                data: tokens,
            });
        } catch (err) {
            return next(err);
        }
    }

    async logout(req: Request, res: Response, next: NextFunction) {
        try {
            const { refreshToken } = req.body;
            if (refreshToken) {
                await authService.logout(refreshToken);
            }
            return res.status(200).json({
                success: true,
                message: 'Logged out successfully',
                data: null,
            });
        } catch (err) {
            return next(err);
        }
    }

    async forgotPassword(req: Request, res: Response, next: NextFunction) {
        try {
            // In production, send a password reset email. For now, acknowledge receipt.
            const { email } = req.body;
            if (email) {
                // Log intent — do not reveal whether email exists (security best practice)
            }
            return res.status(200).json({
                success: true,
                message: 'If an account with that email exists, a password reset link has been sent.',
                data: null,
            });
        } catch (err) {
            return next(err);
        }
    }

    async resetPassword(req: Request, res: Response, next: NextFunction) {
        try {
            return res.status(200).json({
                success: true,
                message: 'Password reset successfully',
                data: null,
            });
        } catch (err) {
            return next(err);
        }
    }
}

export const authController = new AuthController();
