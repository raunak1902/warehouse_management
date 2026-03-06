-- Add subscriptionEndDate to Device
ALTER TABLE "Device" ADD COLUMN "subscriptionEndDate" TIMESTAMP(3);

-- Add subscriptionEndDate to DeviceSet
ALTER TABLE "DeviceSet" ADD COLUMN "subscriptionEndDate" TIMESTAMP(3);

-- Create SubscriptionReminder table
CREATE TABLE "SubscriptionReminder" (
    "id"           SERIAL NOT NULL,
    "deviceId"     INTEGER,
    "setId"        INTEGER,
    "reminderType" TEXT NOT NULL,
    "sentAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionReminder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubscriptionReminder_deviceId_idx" ON "SubscriptionReminder"("deviceId");
CREATE INDEX "SubscriptionReminder_setId_idx"    ON "SubscriptionReminder"("setId");

-- Unique: one reminder per type per device/set (prevents duplicates)
CREATE UNIQUE INDEX "unique_device_reminder" ON "SubscriptionReminder"("deviceId", "reminderType") WHERE "deviceId" IS NOT NULL;
CREATE UNIQUE INDEX "unique_set_reminder"    ON "SubscriptionReminder"("setId",    "reminderType") WHERE "setId"    IS NOT NULL;