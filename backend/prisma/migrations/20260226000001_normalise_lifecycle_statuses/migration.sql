-- Migration: 20260226000001_normalise_lifecycle_statuses
-- Purpose: Rename old lifecycle status strings (from the original devices.js
--          system) to the new unified lifecycle system names used by
--          lifecycleRequests.js. Run this once against your database.
--          Safe to re-run — old values simply won't exist after first run.

-- ── Device table ─────────────────────────────────────────────────────────────
UPDATE "Device" SET "lifecycleStatus" = 'available'
  WHERE "lifecycleStatus" = 'warehouse';

UPDATE "Device" SET "lifecycleStatus" = 'assigning'
  WHERE "lifecycleStatus" IN ('assign_requested', 'assigned');

UPDATE "Device" SET "lifecycleStatus" = 'ready_to_deploy'
  WHERE "lifecycleStatus" = 'deploy_requested';

UPDATE "Device" SET "lifecycleStatus" = 'active'
  WHERE "lifecycleStatus" = 'deployed';

UPDATE "Device" SET "lifecycleStatus" = 'return_initiated'
  WHERE "lifecycleStatus" = 'return_requested';

-- ── DeviceSet table ───────────────────────────────────────────────────────────
UPDATE "DeviceSet" SET "lifecycleStatus" = 'available'
  WHERE "lifecycleStatus" = 'warehouse';

UPDATE "DeviceSet" SET "lifecycleStatus" = 'assigning'
  WHERE "lifecycleStatus" IN ('assign_requested', 'assigned');

UPDATE "DeviceSet" SET "lifecycleStatus" = 'ready_to_deploy'
  WHERE "lifecycleStatus" = 'deploy_requested';

UPDATE "DeviceSet" SET "lifecycleStatus" = 'active'
  WHERE "lifecycleStatus" = 'deployed';

UPDATE "DeviceSet" SET "lifecycleStatus" = 'return_initiated'
  WHERE "lifecycleStatus" = 'return_requested';

-- ── DeviceHistory table (audit trail — rename for consistency) ────────────────
UPDATE "DeviceHistory" SET "fromStatus" = 'available'       WHERE "fromStatus" = 'warehouse';
UPDATE "DeviceHistory" SET "fromStatus" = 'assigning'       WHERE "fromStatus" IN ('assign_requested', 'assigned');
UPDATE "DeviceHistory" SET "fromStatus" = 'ready_to_deploy' WHERE "fromStatus" = 'deploy_requested';
UPDATE "DeviceHistory" SET "fromStatus" = 'active'          WHERE "fromStatus" = 'deployed';
UPDATE "DeviceHistory" SET "fromStatus" = 'return_initiated' WHERE "fromStatus" = 'return_requested';

UPDATE "DeviceHistory" SET "toStatus" = 'available'         WHERE "toStatus" = 'warehouse';
UPDATE "DeviceHistory" SET "toStatus" = 'assigning'         WHERE "toStatus" IN ('assign_requested', 'assigned');
UPDATE "DeviceHistory" SET "toStatus" = 'ready_to_deploy'   WHERE "toStatus" = 'deploy_requested';
UPDATE "DeviceHistory" SET "toStatus" = 'active'            WHERE "toStatus" = 'deployed';
UPDATE "DeviceHistory" SET "toStatus" = 'return_initiated'  WHERE "toStatus" = 'return_requested';
