# AirPMS Findings — Current State

Updated: 2026-05-14 (Post Phase 1 / Session 2)

---

## Git Baseline

Branch: `codex/room-details-enhancements`
Latest commit: `c310c3b enhance room details listing management`

Previous reference branch (not to be merged whole):
```text
codex/airpms-mvc-refactor  — 62 files changed, 7108+, kept as reference only
```

---

## Current Code Structure

### Backend

```text
backend/src/
  index.js                                — all routes registered here
  prisma.js                               — shared Prisma client
  room-profile/                           — NEW: Phase 1 MVC module
    RoomProfileController.js
    RoomProfileService.js
    RoomProfileRepository.js
  services/
    syncIcsStatusService.js               — teammate's, do not modify
    syncLongTermLeasesService.js          — teammate's, do not modify
    downloadDatabaseService.js
  utils/
    ics.js                                — ICS parser (uid support added in Phase 1)
```

### Frontend

```text
frontend/src/
  main.js                                 — uses vue-router now
  router/index.js                         — 3 routes: /, /admin, /rooms/:id
  App.vue                                 — RouterLink + RouterView (no more manual activePage)
  views/
    Dashboard.vue                         — room cells clickable → /rooms/:id
    AdminPanel.vue
    RoomProfile.vue                       — NEW: Phase 1, per-room management page
```

---

## Current Schema

Active models (post Phase 1):

```text
Property
Unit
Room          — added: adminNotes String?
ListingUrl    — added: listingId String?
BookingRecord
```

Phase 2/3 will add: `ReservationRaw`, `ReservationHistory`, `RoomStateSnapshot`

---

## Current API

All live routes in `backend/src/index.js`:

```text
GET    /
GET    /api/rooms/:id/profile                     — NEW Phase 1
PATCH  /api/rooms/:id/admin-notes                 — NEW Phase 1
POST   /api/rooms/:id/listing-urls                — NEW Phase 1
PATCH  /api/rooms/:id/listing-urls/:urlId         — NEW Phase 1
POST   /api/rooms/:id/listing-urls/:urlId/set-primary  — NEW Phase 1
DELETE /api/rooms/:id/listing-urls/:urlId         — NEW Phase 1
POST   /admin/sync-ics
POST   /admin/sync-longterm
POST   /admin/download-data
GET    /properties
POST   /properties
GET    /dashboard/inventory
```

---

## Phase 1 Test Results (Verified Live)

- `GET /api/rooms/:id/profile` → name, status, listing URLs, live reservation with Airbnb link ✅
- `adminNotes` column live in DB ✅
- `listingId` auto-extracted from ICS URL ✅
- Airbnb listing link + host manage link generated from listingId ✅
- Live ICS fetch on profile load: current reservation + confirmation code → reservationLink ✅
- Frontend routing: Dashboard → /rooms/:id → RoomProfile page ✅

---

## Domain Boundaries (Confirmed)

| Domain | Owner | Writes To |
|---|---|---|
| Leasing Occupancy | Teammate | Room.status, Room.note, Unit.status, Unit.note |
| Room State (snapshot) | You | ReservationRaw, ReservationHistory, RoomStateSnapshot |
| Room Profile (shared) | Both | ListingUrl CRUD, Room.adminNotes |

Shared read source: `ListingUrl WHERE isPrimary=true AND status='active' AND roomId != null`

---

## Deployment Notes

Backend start script: `prisma migrate deploy && prisma generate && node src/index.js`

Schema changes must be additive. Migrations live in `backend/prisma/migrations/`.
Three migrations applied:
- Base migration
- Phase 1 migration (adminNotes + listingId + new migrations from teammate)

---

## Next Phase (Phase 2 — Reservation Snapshot Pipeline)

Tables to add: `ReservationRaw`, `ReservationHistory`
Service to create: `backend/src/room-state/ReservationRepository.js`, `ReservationService.js`
New route: `POST /api/room-state/sync`

Constraint: naming must not collide with teammate's existing ReservationRaw/History tables if any exist in DB.
Action needed: verify DB for naming conflicts before writing Phase 2 schema.
