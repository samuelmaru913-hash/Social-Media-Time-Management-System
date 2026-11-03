-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationName" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "iconUrl" TEXT,
    "deviceId" TEXT,
    "monitoringStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyLimit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackedApplicationId" TEXT NOT NULL,
    "limitMinutes" INTEGER NOT NULL DEFAULT 180,
    "warningThreshold" INTEGER NOT NULL DEFAULT 80,
    "scheduleConfiguration" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackedApplicationId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "usageDurationSeconds" INTEGER NOT NULL DEFAULT 0,
    "sourceDeviceId" TEXT,
    "syncId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Study Session',
    "plannedDurationMinutes" INTEGER NOT NULL DEFAULT 25,
    "actualDurationSeconds" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "limitWarningsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "studyRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailySummaryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "resetReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "warningThresholds" TEXT NOT NULL DEFAULT '[80, 90, 100]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshTokenSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshTokenSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyGoalMinutes" INTEGER NOT NULL DEFAULT 120,
    "studyGoalMinutes" INTEGER NOT NULL DEFAULT 120,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "TrackedApplication_userId_idx" ON "TrackedApplication"("userId");

-- CreateIndex
CREATE INDEX "TrackedApplication_packageName_idx" ON "TrackedApplication"("packageName");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedApplication_userId_packageName_key" ON "TrackedApplication"("userId", "packageName");

-- CreateIndex
CREATE INDEX "DailyLimit_userId_idx" ON "DailyLimit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLimit_userId_trackedApplicationId_key" ON "DailyLimit"("userId", "trackedApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageRecord_syncId_key" ON "UsageRecord"("syncId");

-- CreateIndex
CREATE INDEX "UsageRecord_userId_idx" ON "UsageRecord"("userId");

-- CreateIndex
CREATE INDEX "UsageRecord_userId_localDate_idx" ON "UsageRecord"("userId", "localDate");

-- CreateIndex
CREATE INDEX "UsageRecord_trackedApplicationId_idx" ON "UsageRecord"("trackedApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageRecord_userId_trackedApplicationId_localDate_sourceDev_key" ON "UsageRecord"("userId", "trackedApplicationId", "localDate", "sourceDeviceId");

-- CreateIndex
CREATE INDEX "StudySession_userId_idx" ON "StudySession"("userId");

-- CreateIndex
CREATE INDEX "StudySession_userId_status_idx" ON "StudySession"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshTokenSession_tokenHash_key" ON "RefreshTokenSession"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshTokenSession_userId_idx" ON "RefreshTokenSession"("userId");

-- CreateIndex
CREATE INDEX "RefreshTokenSession_tokenHash_idx" ON "RefreshTokenSession"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- AddForeignKey
ALTER TABLE "TrackedApplication" ADD CONSTRAINT "TrackedApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLimit" ADD CONSTRAINT "DailyLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLimit" ADD CONSTRAINT "DailyLimit_trackedApplicationId_fkey" FOREIGN KEY ("trackedApplicationId") REFERENCES "TrackedApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_trackedApplicationId_fkey" FOREIGN KEY ("trackedApplicationId") REFERENCES "TrackedApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshTokenSession" ADD CONSTRAINT "RefreshTokenSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
