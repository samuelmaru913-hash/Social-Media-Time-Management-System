import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_APPS = [
    { applicationName: 'TikTok', packageName: 'com.zhiliaoapp.musically' },
    { applicationName: 'Instagram', packageName: 'com.instagram.android' },
    { applicationName: 'Facebook', packageName: 'com.facebook.katana' },
    { applicationName: 'YouTube', packageName: 'com.google.android.youtube' },
    { applicationName: 'Telegram', packageName: 'org.telegram.messenger' },
    { applicationName: 'Twitter / X', packageName: 'com.twitter.android' },
    { applicationName: 'Snapchat', packageName: 'com.snapchat.android' },
];

async function seed() {
    console.log('🌱 Seeding development data...');

    // Create demo student
    const passwordHash = await bcrypt.hash('Student123', 12);
    const student = await prisma.user.upsert({
        where: { email: 'student@focusguard.dev' },
        update: {},
        create: {
            fullName: 'Demo Student',
            email: 'student@focusguard.dev',
            passwordHash,
            role: 'STUDENT',
            timeZone: 'America/New_York',
        },
    });

    // Create demo admin
    const adminHash = await bcrypt.hash('Admin123', 12);
    await prisma.user.upsert({
        where: { email: 'admin@focusguard.dev' },
        update: {},
        create: {
            fullName: 'System Admin',
            email: 'admin@focusguard.dev',
            passwordHash: adminHash,
            role: 'ADMIN',
            timeZone: 'UTC',
        },
    });

    // Create notification preferences and user preferences for student
    await prisma.notificationPreference.upsert({
        where: { userId: student.id },
        update: {},
        create: { userId: student.id },
    });

    await prisma.userPreferences.upsert({
        where: { userId: student.id },
        update: {},
        create: { userId: student.id },
    });

    // Create tracked applications
    for (const app of DEMO_APPS) {
        const trackedApp = await prisma.trackedApplication.upsert({
            where: { userId_packageName: { userId: student.id, packageName: app.packageName } },
            update: {},
            create: {
                userId: student.id,
                applicationName: app.applicationName,
                packageName: app.packageName,
                isEnabled: true,
            },
        });

        // Create daily limit (3 hours default)
        await prisma.dailyLimit.upsert({
            where: {
                userId_trackedApplicationId: {
                    userId: student.id,
                    trackedApplicationId: trackedApp.id,
                },
            },
            update: {},
            create: {
                userId: student.id,
                trackedApplicationId: trackedApp.id,
                limitMinutes: 180,
                warningThreshold: 80,
            },
        });

        // Create sample usage for the past 7 days
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const localDate = date.toISOString().split('T')[0];
            const usageSeconds = Math.floor(Math.random() * 7200) + 600; // 10min - 2hr

            await prisma.usageRecord.upsert({
                where: {
                    userId_trackedApplicationId_localDate_sourceDeviceId: {
                        userId: student.id,
                        trackedApplicationId: trackedApp.id,
                        localDate,
                        sourceDeviceId: 'demo-seed-device',
                    },
                },
                update: {},
                create: {
                    userId: student.id,
                    trackedApplicationId: trackedApp.id,
                    localDate,
                    timeZone: 'America/New_York',
                    usageDurationSeconds: usageSeconds,
                    sourceDeviceId: 'demo-seed-device',
                    syncId: `seed-${student.id}-${trackedApp.id}-${localDate}`,
                },
            });
        }
    }

    // Create sample study sessions
    const session1 = await prisma.studySession.create({
        data: {
            userId: student.id,
            title: 'Mathematics Study',
            plannedDurationMinutes: 45,
            actualDurationSeconds: 2700,
            status: 'COMPLETED',
            startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
            completedAt: new Date(Date.now() - 2.25 * 60 * 60 * 1000),
        },
    });

    console.log('✅ Seed completed!');
    console.log('📋 Demo credentials:');
    console.log('   Student: student@focusguard.dev / Student123');
    console.log('   Admin:   admin@focusguard.dev / Admin123');
}

seed()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
