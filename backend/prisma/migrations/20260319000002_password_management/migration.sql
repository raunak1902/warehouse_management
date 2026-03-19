-- Add password management fields to User table

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt"  TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "otpHash"            TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "otpExpiresAt"       TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "otpResetToken"      TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "otpResetTokenExp"   TIMESTAMP(3);