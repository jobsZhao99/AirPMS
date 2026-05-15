-- 让数据库结构和远程当前 schema 对齐。
-- 这些字段有些来自队友通过 db push 调整后的模型；迁移里用 IF NOT EXISTS，
-- 这样本地、Render 或 Neon 上重复执行也不会破坏已有数据。

ALTER TABLE "Property"
ADD COLUMN IF NOT EXISTS "AvailabilityStatus" TEXT NOT NULL DEFAULT 'Available',
ADD COLUMN IF NOT EXISTS "AvailableFrom" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "AvailableTo" TIMESTAMP(3);

ALTER TABLE "Unit"
ADD COLUMN IF NOT EXISTS "AvailabilityStatus" TEXT NOT NULL DEFAULT 'Available',
ADD COLUMN IF NOT EXISTS "AvailableFrom" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "AvailableTo" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "leasingStatus" TEXT NOT NULL DEFAULT 'Vacant';

-- 如果旧表还保留 Unit.status，先把原来的出租状态迁到 AvailabilityStatus。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Unit' AND column_name = 'status'
  ) THEN
    UPDATE "Unit"
    SET "AvailabilityStatus" = COALESCE(NULLIF("status", ''), "AvailabilityStatus");
  END IF;
END $$;

ALTER TABLE "Room"
ADD COLUMN IF NOT EXISTS "leasingStatus" TEXT NOT NULL DEFAULT 'Vacant';

ALTER TABLE "ListingUrl"
ADD COLUMN IF NOT EXISTS "listingId" TEXT;

-- 回填 Airbnb ICS URL 中的 listing id，供详情页生成 Airbnb 管理链接。
UPDATE "ListingUrl"
SET "listingId" = substring("url" from '/calendar/ical/([0-9]+)\.ics')
WHERE ("listingId" IS NULL OR "listingId" = '')
  AND lower("url") LIKE '%airbnb.com/calendar/ical/%';

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BookingRecord_roomId_fkey'
  ) THEN
    ALTER TABLE "BookingRecord"
    ADD CONSTRAINT "BookingRecord_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BookingRecord_unitId_fkey'
  ) THEN
    ALTER TABLE "BookingRecord"
    ADD CONSTRAINT "BookingRecord_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BookingRecord_listingUrlId_fkey'
  ) THEN
    ALTER TABLE "BookingRecord"
    ADD CONSTRAINT "BookingRecord_listingUrlId_fkey"
    FOREIGN KEY ("listingUrlId") REFERENCES "ListingUrl"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
