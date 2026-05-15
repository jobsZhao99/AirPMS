# AirPMS Development Plan

Updated: 2026-05-14 (Session 2)

---

## Current Baseline (Phase 1 complete)

Active schema (双方共同开发基线): `Property → Unit → Room → ListingUrl`
New fields added: `Room.adminNotes`, `ListingUrl.listingId`

Note: DB 里有一批从 Google Sheets 迁移遗留的老表（Listing、ReservationRaw 等），不是当前活跃开发的一部分，忽略。

Working features:
- ICS sync → writes `Room.status` / `Room.note`
- Long-term CSV sync → writes `Room.status` / `Room.note`
- `/dashboard/inventory` — property/unit/room tree
- Admin: sync-ics, sync-longterm, download-data

---

## Domain Boundaries (Non-Negotiable)

### Teammate — Leasing Occupancy
Owns: `Room.status`, `Room.note`, `Unit.status`, `Unit.note`
Services: `syncIcsStatusService.js`, `syncLongTermLeasesService.js`
Reads: `ListingUrl` (isPrimary=true, status=active) → writes back to Room/Unit
Logic: point-in-time status — "is this room rented right now?"

### You — Room State (snapshot-based)
Owns: `ReservationRaw`, `ReservationHistory`, `RoomStateSnapshot` (new tables)
Services: `room-state/` module (new)
Reads: `ListingUrl` (isPrimary=true, status=active) — same source, different output
Logic: historical snapshot diff — Dirty/Cleaned/Occupied/SameDay/ShortGap

### Shared — Room Profile
Owns: `ListingUrl` CRUD, `Room.adminNotes` (new field)
Both teammates read ListingUrl; profile feature manages it via API
Neither sync service touches `adminNotes`

---

## Why Two Approaches Coexist Without Conflict

Teammate's sync writes to:       Room.status, Room.note
Your sync writes to:              ReservationRaw, ReservationHistory, RoomStateSnapshot
Profile CRUD writes to:           ListingUrl, Room.adminNotes

Zero field overlap. Both read ListingUrl.url but never write to it during sync.

---

## Teammate's Refresh Logic (Reference — Do Not Modify)

syncIcsStatus():
  1. Query ListingUrl WHERE isPrimary=true AND status='active' AND roomId != null
  2. For each URL: fetch ICS → parse → get {status, note}
  3. Write Room.status = "Airbnb Rented" | "Booking.com Rented" | "Vacant" | "ICS Error"
  4. Write Room.note = date ranges string (e.g. "2025-01-15 - 2025-01-20")
  5. Same for unitId listings → Unit.status / Unit.note

syncLongTermLeases():
  1. Read Tenant Directory.csv
  2. Match rows to Room by room.appfolioName (normalized)
  3. If room already has "Airbnb Rented" or "Booking.com Rented" → keep status, merge note
  4. Otherwise → Room.status = "Long Term", Room.note = tenant info block

Constraint: your code must never write Room.status, Room.note, Unit.status, Unit.note

---

## MVC Architecture (Your Domain)

```
backend/src/
  room-state/                          ← your module, teammate does not touch
    RoomStateController.js             HTTP only: parse req, call service, return res
    RoomStateService.js                state engine: Dirty/Cleaned/Occupied/SameDay logic
    ReservationService.js              ICS fetch + snapshot save + history diff
    RoomStateRepository.js             all prisma calls for RoomStateSnapshot
    ReservationRepository.js           all prisma calls for ReservationRaw/History

  room-profile/                        ← shared module (agreed with teammate)
    RoomProfileController.js
    RoomProfileService.js
    RoomProfileRepository.js

  shared/
    prisma.js                          existing — read only
    ics.js (utils/ics.js)              existing ICS parser — reuse, do not copy
```

Route additions to index.js (only additions, no changes):
  GET  /api/rooms/:id/profile
  POST /api/rooms/:id/listing-urls
  PATCH /api/rooms/:id/listing-urls/:urlId
  DELETE /api/rooms/:id/listing-urls/:urlId
  PATCH /api/rooms/:id/admin-notes
  POST /api/room-state/sync
  GET  /api/room-state/grid
  GET  /api/room-state/list

---

## Schema Changes (Additive Only)

### Add to Room model (1 new field):
  adminNotes  String?    -- user-managed notes, never touched by sync

### Add 3 new models:

model ReservationRaw {
  id           String     @id @default(cuid())
  rawKey       String     @unique          -- listingUrlId|checkIn|checkOut|uid
  listingUrlId String
  checkIn      DateTime
  checkOut     DateTime
  summary      String?
  eventType    String     @default("Reservation")
  uid          String?
  importedAt   DateTime
  createdAt    DateTime   @default(now())
  listingUrl   ListingUrl @relation(fields: [listingUrlId], references: [id])
}

model ReservationHistory {
  id                String     @id @default(cuid())
  historyKey        String     @unique
  listingUrlId      String
  checkIn           DateTime
  checkOut          DateTime
  summary           String?
  eventType         String
  uid               String?
  isCurrent         Boolean    @default(true)
  disappearedStatus String?    -- PAST_REMOVED | CANCELLED_REMOVED | null
  firstSeenAt       DateTime
  lastSeenAt        DateTime
  removedAt         DateTime?
  createdAt         DateTime   @default(now())
  listingUrl        ListingUrl @relation(fields: [listingUrlId], references: [id])
}

model RoomStateSnapshot {
  id            String     @id @default(cuid())
  listingUrlId  String     @unique
  roomId        String?
  stateCode     String     -- DIRTY | CLEANED | OCCUPIED | SAME_DAY | SHORT_GAP_DIRTY | SHORT_GAP_CLEANED | VACANT
  stateLabel    String?
  lastCheckOut  DateTime?
  lastCleaned   DateTime?
  nextCheckIn   DateTime?
  vacantDays    Int?
  generatedAt   DateTime
  createdAt     DateTime   @default(now())
  listingUrl    ListingUrl @relation(fields: [listingUrlId], references: [id])
}

---

## Phase Plan

### Phase 0 — Baseline Stable ✅
Current master is working. No changes needed.

### Phase 1 — Room Profile (Shared, Small PR) ✅ COMPLETE
Branch: feat/room-profile
Goal: frontend can manage ListingUrls and admin notes per room
Schema changes applied:
  - Room.adminNotes String? ✅
  - ListingUrl.listingId String? ✅ (Airbnb listing ID auto-extracted from ICS URL)
Files created:
  - backend/src/room-profile/RoomProfileController.js ✅
  - backend/src/room-profile/RoomProfileService.js ✅
  - backend/src/room-profile/RoomProfileRepository.js ✅
  - backend/src/utils/ics.js — added uid extraction (extractICSUid) ✅
  - frontend/src/views/RoomProfile.vue ✅
  - frontend/src/router/index.js ✅
  - frontend/src/main.js — added vue-router ✅
  - frontend/src/App.vue — RouterLink + RouterView ✅
  - Dashboard.vue — room cells clickable → /rooms/:id ✅
API (all live, tested):
  GET    /api/rooms/:id/profile           ✅ returns status, live reservation, listing URLs w/ Airbnb links
  POST   /api/rooms/:id/listing-urls      ✅
  PATCH  /api/rooms/:id/listing-urls/:urlId  ✅
  POST   /api/rooms/:id/listing-urls/:urlId/set-primary ✅
  DELETE /api/rooms/:id/listing-urls/:urlId  ✅
  PATCH  /api/rooms/:id/admin-notes       ✅
Teammate impact: zero
Tested: live ICS fetch works, Airbnb reservation link generated correctly

### Phase 2 — Reservation Snapshot Pipeline (Your Domain)
Branch: feat/room-state-pipeline
Goal: ICS fetch → structured snapshot → history diff
Schema changes: add ReservationRaw + ReservationHistory (linked to ListingUrl)
Files to create:
  - backend/src/room-state/ReservationRepository.js
  - backend/src/room-state/ReservationService.js
API:
  POST /api/room-state/sync    -- trigger ICS fetch for all active primary URLs
Logic:
  1. Query ListingUrl (isPrimary=true, active, roomId != null)
  2. Fetch ICS → parse events (reuse utils/ics.js parser)
  3. Upsert ReservationRaw (rawKey = listingUrlId|checkIn|checkOut|uid)
  4. Diff against ReservationHistory:
     - New events → create history row (isCurrent=true)
     - Existing events → update lastSeenAt
     - Missing events → mark disappearedStatus:
         checkOut < today → PAST_REMOVED
         checkOut >= today → CANCELLED_REMOVED
Teammate impact: zero (new tables, reads same ListingUrl source)
Status: pending

### Phase 3 — Room State Engine (Your Domain)
Branch: feat/room-state-engine (or same as Phase 2)
Goal: ReservationHistory → RoomStateSnapshot
Schema changes: add RoomStateSnapshot
Files to create:
  - backend/src/room-state/RoomStateRepository.js
  - backend/src/room-state/RoomStateService.js
  - backend/src/room-state/RoomStateController.js
State priority logic:
  OCCUPIED       -- current date is between checkIn and checkOut
  SAME_DAY       -- checkout and checkin on same calendar day
  SHORT_GAP_DIRTY/CLEANED  -- next checkin within 31 days
  DIRTY          -- had past checkout, not yet cleaned
  CLEANED        -- cleaned after last checkout
  VACANT         -- no history, no upcoming
API:
  GET /api/room-state/grid    -- grouped by property, for frontend tiles
  GET /api/room-state/list    -- flat list
Teammate impact: zero
Status: pending

### Phase 4 — Frontend Room State Page (Your Domain)
Branch: feat/frontend-room-state
Goal: visual room state map
Files to create:
  - frontend/src/views/RoomState.vue
  - frontend/src/router/index.js (if not exists)
Teammate impact: zero (new page)
Status: pending

### Phase 5 — Frontend Room Profile Page (Shared)
Branch: feat/frontend-room-profile
Goal: per-room management page
Features:
  - View room info + current status (from teammate's Room.status)
  - Manage ListingUrls (add/set primary/deactivate)
  - Edit adminNotes
Status: pending

---

## Interface Contract Between Domains

The only shared data source both services read:
  ListingUrl WHERE isPrimary=true AND status='active' AND roomId != null

Teammate reads it → writes Room.status/note
You read it → writes ReservationRaw/History/RoomStateSnapshot

This table is managed by the Room Profile feature (Phase 1).
If a URL is set as primary or deactivated, both sync pipelines are affected.
Coordinate with teammate before changing ListingUrl schema.

---

## Non-Negotiable Rules

1. Never write Room.status, Room.note, Unit.status, Unit.note (teammate owns these)
2. Never modify syncIcsStatusService.js or syncLongTermLeasesService.js
3. Schema changes must be additive (no column renames or deletions)
4. Schema changes need teammate review before db:push
5. index.js changes: only add new routes, never modify existing routes
6. Reuse utils/ics.js ICS parser — do not copy it into your module
