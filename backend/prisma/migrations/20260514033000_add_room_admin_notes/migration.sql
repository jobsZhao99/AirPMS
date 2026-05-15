-- Room.note 保留给系统同步结果；adminNotes 专门存人工运营备注。
ALTER TABLE "Room"
ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;
