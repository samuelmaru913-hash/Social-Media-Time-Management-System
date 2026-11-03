-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TrackedApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "applicationName" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "iconUrl" TEXT,
    "deviceId" TEXT,
    "monitoringStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrackedApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TrackedApplication" ("applicationName", "createdAt", "iconUrl", "id", "isEnabled", "packageName", "updatedAt", "userId") SELECT "applicationName", "createdAt", "iconUrl", "id", "isEnabled", "packageName", "updatedAt", "userId" FROM "TrackedApplication";
DROP TABLE "TrackedApplication";
ALTER TABLE "new_TrackedApplication" RENAME TO "TrackedApplication";
CREATE INDEX "TrackedApplication_userId_idx" ON "TrackedApplication"("userId");
CREATE INDEX "TrackedApplication_packageName_idx" ON "TrackedApplication"("packageName");
CREATE UNIQUE INDEX "TrackedApplication_userId_packageName_key" ON "TrackedApplication"("userId", "packageName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
