-- Migration: add_password_management_fields
-- Adds password management columns; drops old OTP columns if they exist.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "mustChangePassword"  BOOLEAN      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "passwordChangedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "accountLockedUntil"  TIMESTAMP(3);

-- Drop OTP columns added by the old password_management migration (no longer in schema)
ALTER TABLE "User" DROP COLUMN IF EXISTS "otpHash";
ALTER TABLE "User" DROP COLUMN IF EXISTS "otpExpiresAt";
ALTER TABLE "User" DROP COLUMN IF EXISTS "otpResetToken";
ALTER TABLE "User" DROP COLUMN IF EXISTS "otpResetTokenExp";

-- Existing users already have working passwords — don't force them to change
UPDATE "User" SET "mustChangePassword" = false WHERE "mustChangePassword" = true;