-- CreateTable
CREATE TABLE "ListingUrl" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'Unknown',
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "roomId" TEXT,
    "unitId" TEXT,

    CONSTRAINT "ListingUrl_pkey" PRIMARY KEY ("id")
);

-- Preserve existing Room.url data as primary active room listing URLs.
INSERT INTO "ListingUrl" ("id", "url", "channel", "status", "isPrimary", "roomId")
SELECT
    'migrated_room_' || "id"::text,
    "url",
    CASE
        WHEN lower("url") LIKE '%booking.com%' OR lower("url") LIKE '%admin.booking%' THEN 'Booking.com'
        WHEN lower("url") LIKE '%airbnb.com%' THEN 'Airbnb'
        WHEN lower("url") LIKE '%vrbo.com%' THEN 'VRBO'
        ELSE 'Unknown'
    END,
    'active',
    true,
    "id"
FROM "Room"
WHERE "url" IS NOT NULL AND trim("url") <> '';

-- Preserve existing Unit.url data as primary active unit listing URLs.
INSERT INTO "ListingUrl" ("id", "url", "channel", "status", "isPrimary", "unitId")
SELECT
    'migrated_unit_' || "id"::text,
    "url",
    CASE
        WHEN lower("url") LIKE '%booking.com%' OR lower("url") LIKE '%admin.booking%' THEN 'Booking.com'
        WHEN lower("url") LIKE '%airbnb.com%' THEN 'Airbnb'
        WHEN lower("url") LIKE '%vrbo.com%' THEN 'VRBO'
        ELSE 'Unknown'
    END,
    'active',
    true,
    "id"
FROM "Unit"
WHERE "url" IS NOT NULL AND trim("url") <> '';

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "url";

-- AlterTable
ALTER TABLE "Unit" DROP COLUMN "url";

-- CreateIndex
CREATE INDEX "ListingUrl_roomId_idx" ON "ListingUrl"("roomId");

-- CreateIndex
CREATE INDEX "ListingUrl_unitId_idx" ON "ListingUrl"("unitId");

-- One ListingUrl row must belong to exactly one parent target.
ALTER TABLE "ListingUrl" ADD CONSTRAINT "ListingUrl_exactly_one_parent_chk"
CHECK (
    ("roomId" IS NOT NULL AND "unitId" IS NULL)
    OR
    ("roomId" IS NULL AND "unitId" IS NOT NULL)
);

-- Allow only one primary listing URL per room.
CREATE UNIQUE INDEX "ListingUrl_one_primary_per_room_idx"
ON "ListingUrl"("roomId")
WHERE "isPrimary" = true AND "roomId" IS NOT NULL;

-- Allow only one primary listing URL per unit.
CREATE UNIQUE INDEX "ListingUrl_one_primary_per_unit_idx"
ON "ListingUrl"("unitId")
WHERE "isPrimary" = true AND "unitId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "ListingUrl" ADD CONSTRAINT "ListingUrl_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingUrl" ADD CONSTRAINT "ListingUrl_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
