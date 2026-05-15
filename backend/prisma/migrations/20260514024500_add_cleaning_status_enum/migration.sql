-- 远程队友提交的基础数据库调整：
-- 把 Unit / Room 的 cleaningStatus 从普通文本收敛成 Prisma enum。
DO $$
BEGIN
  CREATE TYPE "CleaningStatus" AS ENUM (
    'Cleaned',
    'Dirty',
    'UnderPipeline',
    'Need Setup',
    'Need Spiff',
    'Occupied'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Unit"
ADD COLUMN IF NOT EXISTS "cleaningStatus" TEXT NOT NULL DEFAULT 'UnderPipeline';

ALTER TABLE "Room"
ADD COLUMN IF NOT EXISTS "cleaningStatus" TEXT NOT NULL DEFAULT 'UnderPipeline';

UPDATE "Unit"
SET "cleaningStatus" = 'UnderPipeline'
WHERE "cleaningStatus" NOT IN (
  'Cleaned',
  'Dirty',
  'UnderPipeline',
  'Need Setup',
  'Need Spiff',
  'Occupied'
);

UPDATE "Room"
SET "cleaningStatus" = 'UnderPipeline'
WHERE "cleaningStatus" NOT IN (
  'Cleaned',
  'Dirty',
  'UnderPipeline',
  'Need Setup',
  'Need Spiff',
  'Occupied'
);

ALTER TABLE "Unit"
ALTER COLUMN "cleaningStatus" DROP DEFAULT,
ALTER COLUMN "cleaningStatus" TYPE "CleaningStatus" USING ("cleaningStatus"::text::"CleaningStatus"),
ALTER COLUMN "cleaningStatus" SET DEFAULT 'UnderPipeline';

ALTER TABLE "Room"
ALTER COLUMN "cleaningStatus" DROP DEFAULT,
ALTER COLUMN "cleaningStatus" TYPE "CleaningStatus" USING ("cleaningStatus"::text::"CleaningStatus"),
ALTER COLUMN "cleaningStatus" SET DEFAULT 'UnderPipeline';
