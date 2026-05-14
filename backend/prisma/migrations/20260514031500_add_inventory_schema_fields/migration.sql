-- Bring existing databases up to the current Prisma schema.
-- Prisma selects all scalar columns for included models, so missing columns here
-- can make dashboard reads fail with a 500 before frontend rendering starts.

ALTER TABLE "Property"
ADD COLUMN IF NOT EXISTS "AvailabilityStatus" TEXT NOT NULL DEFAULT 'Available',
ADD COLUMN IF NOT EXISTS "AvailableFrom" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "AvailableTo" TIMESTAMP(3);

ALTER TABLE "Unit"
ADD COLUMN IF NOT EXISTS "AvailabilityStatus" TEXT NOT NULL DEFAULT 'Available',
ADD COLUMN IF NOT EXISTS "AvailableFrom" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "AvailableTo" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "note" TEXT,
ADD COLUMN IF NOT EXISTS "leasingStatus" TEXT NOT NULL DEFAULT 'Vacant';

ALTER TABLE "Room"
ADD COLUMN IF NOT EXISTS "listingName" TEXT,
ADD COLUMN IF NOT EXISTS "appfolioName" TEXT,
ADD COLUMN IF NOT EXISTS "note" TEXT,
ADD COLUMN IF NOT EXISTS "leasingStatus" TEXT NOT NULL DEFAULT 'Vacant';

ALTER TABLE "ListingUrl"
ADD COLUMN IF NOT EXISTS "listingId" TEXT;

CREATE TABLE IF NOT EXISTS "BookingRecord" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Confirmed',
  "guestName" TEXT,
  "guestId" TEXT,
  "reservationCode" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "guestPay" DOUBLE PRECISION,
  "hostPayout" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "roomId" TEXT,
  "unitId" TEXT,
  "listingUrlId" TEXT,

  CONSTRAINT "BookingRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BookingRecord_roomId_idx"
ON "BookingRecord"("roomId");

CREATE INDEX IF NOT EXISTS "BookingRecord_unitId_idx"
ON "BookingRecord"("unitId");

CREATE INDEX IF NOT EXISTS "BookingRecord_listingUrlId_idx"
ON "BookingRecord"("listingUrlId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'BookingRecord_roomId_fkey'
  ) THEN
    ALTER TABLE "BookingRecord"
    ADD CONSTRAINT "BookingRecord_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "Room"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'BookingRecord_unitId_fkey'
  ) THEN
    ALTER TABLE "BookingRecord"
    ADD CONSTRAINT "BookingRecord_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'BookingRecord_listingUrlId_fkey'
  ) THEN
    ALTER TABLE "BookingRecord"
    ADD CONSTRAINT "BookingRecord_listingUrlId_fkey"
    FOREIGN KEY ("listingUrlId") REFERENCES "ListingUrl"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
