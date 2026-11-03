import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';

const BASE = '/api/v1';
let studentToken: string;
let studentId: string;
let testEmail: string;

beforeAll(async () => {
    testEmail = `test_${Date.now()}@focusguard.dev`;
});

afterAll(async () => {
    // Clean up test user
    if (studentId) {
        await prisma.user.delete({ where: { id: studentId } }).catch(() => { });
    }
    await prisma.$disconnect();
});

describe('Auth API', () => {
    describe('POST /auth/register', () => {
        it('registers a new user successfully', async () => {
            const res = await request(app).post(`${BASE}/auth/register`).send({
                fullName: 'Test Student',
                email: testEmail,
                password: 'Student123',
                timeZone: 'UTC',
            });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.user.email).toBe(testEmail);
            expect(res.body.data.accessToken).toBeDefined();
            expect(res.body.data.refreshToken).toBeDefined();
            studentToken = res.body.data.accessToken;
            studentId = res.body.data.user.id;
        });

        it('rejects duplicate email', async () => {
            const res = await request(app).post(`${BASE}/auth/register`).send({
                fullName: 'Another',
                email: testEmail,
                password: 'Student123',
            });
            expect(res.status).toBe(409);
            expect(res.body.success).toBe(false);
        });

        it('validates required fields', async () => {
            const res = await request(app).post(`${BASE}/auth/register`).send({
                fullName: 'No',
                email: 'notanemail',
                password: 'short',
            });
            expect(res.status).toBe(422);
            expect(res.body.success).toBe(false);
        });
    });

    describe('POST /auth/login', () => {
        it('logs in with valid credentials', async () => {
            const res = await request(app).post(`${BASE}/auth/login`).send({
                email: testEmail,
                password: 'Student123',
            });
            expect(res.status).toBe(200);
            expect(res.body.data.accessToken).toBeDefined();
            studentToken = res.body.data.accessToken;
        });

        it('rejects invalid password', async () => {
            const res = await request(app).post(`${BASE}/auth/login`).send({
                email: testEmail,
                password: 'WrongPassword1',
            });
            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it('rejects non-existent email', async () => {
            const res = await request(app).post(`${BASE}/auth/login`).send({
                email: 'nobody@nowhere.dev',
                password: 'Whatever1',
            });
            expect(res.status).toBe(401);
        });
    });
});

describe('Applications API', () => {
    let appId: string;

    it('requires authentication', async () => {
        const res = await request(app).get(`${BASE}/applications`);
        expect(res.status).toBe(401);
    });

    it('creates a tracked application', async () => {
        const res = await request(app)
            .post(`${BASE}/applications`)
            .set('Authorization', `Bearer ${studentToken}`)
            .send({ applicationName: 'TikTok Test', packageName: 'com.test.tiktok' });
        expect(res.status).toBe(201);
        expect(res.body.data.packageName).toBe('com.test.tiktok');
        appId = res.body.data.id;
    });

    it('lists applications', async () => {
        const res = await request(app)
            .get(`${BASE}/applications`)
            .set('Authorization', `Bearer ${studentToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('creates a daily limit', async () => {
        const res = await request(app)
            .post(`${BASE}/limits`)
            .set('Authorization', `Bearer ${studentToken}`)
            .send({ trackedApplicationId: appId, limitMinutes: 60, warningThreshold: 80 });
        expect(res.status).toBe(201);
        expect(res.body.data.limitMinutes).toBe(60);
    });

    it('deletes the application', async () => {
        const res = await request(app)
            .delete(`${BASE}/applications/${appId}`)
            .set('Authorization', `Bearer ${studentToken}`);
        expect(res.status).toBe(200);
    });
});

describe('Usage API', () => {
    it('returns today\'s usage', async () => {
        const res = await request(app)
            .get(`${BASE}/usage/today`)
            .set('Authorization', `Bearer ${studentToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.usage).toBeDefined();
    });

    it('rejects sync with invalid data', async () => {
        const res = await request(app)
            .post(`${BASE}/usage/sync`)
            .set('Authorization', `Bearer ${studentToken}`)
            .send({ records: [] });
        expect(res.status).toBe(422);
    });
});

describe('Study Sessions API', () => {
    let sessionId: string;

    it('creates a study session', async () => {
        const res = await request(app)
            .post(`${BASE}/study-sessions`)
            .set('Authorization', `Bearer ${studentToken}`)
            .send({ title: 'Math Test', plannedDurationMinutes: 25 });
        expect(res.status).toBe(201);
        expect(res.body.data.status).toBe('ACTIVE');
        sessionId = res.body.data.id;
    });

    it('completes a study session', async () => {
        const res = await request(app)
            .post(`${BASE}/study-sessions/${sessionId}/complete`)
            .set('Authorization', `Bearer ${studentToken}`)
            .send({ actualDurationSeconds: 1500 });
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('COMPLETED');
    });
});

describe('Health Check', () => {
    it('returns healthy status', async () => {
        const res = await request(app).get(`${BASE}/health`);
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('healthy');
    });
});
