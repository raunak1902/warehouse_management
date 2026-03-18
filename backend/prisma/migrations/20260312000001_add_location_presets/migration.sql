-- Migration: add_location_presets
-- Adds a global catalogue table for warehouse-specific location preset suggestions.
-- These are manager-defined hints shown as clickable chips in the Specific Location
-- field when adding/editing devices. The field remains free-text; presets are optional.

-- CreateTable
CREATE TABLE "CatalogueLocationPreset" (
    "id"        SERIAL NOT NULL,
    "name"      TEXT NOT NULL,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogueLocationPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique preset names (case-insensitive enforced at app level)
CREATE UNIQUE INDEX "CatalogueLocationPreset_name_key" ON "CatalogueLocationPreset"("name");
