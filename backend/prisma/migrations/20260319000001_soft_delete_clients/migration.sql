-- Add soft-delete fields to Client table
-- Clients are never hard-deleted — isArchived=true hides them from active views

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "isArchived"   BOOLEAN      NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "archivedAt"   TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "archivedById" INTEGER;

CREATE INDEX IF NOT EXISTS "Client_isArchived_idx" ON "Client"("isArchived");