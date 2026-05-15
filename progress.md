# AirPMS Progress Log

---

## 2026-05-14 — Remote Rollback Realignment

### What Happened
Remote master rolled back by teammate to commit `8063c39 revert and add create and update timestamp`.
Local master aligned to remote. MVC refactor preserved in `codex/airpms-mvc-refactor` branch as reference only.

### Current Baseline
Schema: Property → Unit → Room → ListingUrl (4 tables)
Working: ICS sync, LongTerm sync, /dashboard/inventory, admin endpoints

---

## 2026-05-14 — Architecture Analysis + Plan

### Teammate's Refresh Logic (fully understood)

syncIcsStatus():
- Reads ListingUrl (isPrimary, active, roomId/unitId)
- Fetches ICS → parses with utils/ics.js → gets {status, note}
- Writes Room.status: "Airbnb Rented" | "Booking.com Rented" | "Vacant" | "ICS Error"
- Writes Room.note: date range strings

syncLongTermLeases():
- Reads Tenant Directory.csv → matches by room.appfolioName (normalized)
- Respects existing "Airbnb Rented"/"Booking.com Rented" — does not overwrite
- Otherwise sets Room.status = "Long Term", Room.note = tenant block

Key insight: teammate's approach is stateless point-in-time.
Your approach is snapshot + history diff — more robust for operational room state.

### Domain Separation Confirmed

| Domain | Owner | Writes To |
|---|---|---|
| Leasing Occupancy | Teammate | Room.status, Room.note |
| Room State (snapshot) | You | ReservationRaw, ReservationHistory, RoomStateSnapshot |
| Room Profile (shared) | Both | ListingUrl CRUD, Room.adminNotes |

Zero field overlap between your domain and teammate's domain.

### Listing Profile Feature Analysis

Schema already has everything needed:
- Room.name, listingName, appfolioName, note (system-managed by sync)
- ListingUrl: url, channel, status, notes, isPrimary, roomId, unitId

Missing — need to add:
- Room.adminNotes String? (user-managed, never touched by sync services)

Feature allows:
- View room profile with all ListingUrls
- Add/remove ICS calendar links
- Set primary calendar link (isPrimary=true → affects both sync pipelines)
- Edit user-managed notes (adminNotes, separate from Room.note)

### Plan Written
See task_plan.md — 5 phases:
  Phase 1: Room Profile CRUD (shared, small PR)
  Phase 2: Reservation Snapshot Pipeline (your domain)
  Phase 3: Room State Engine (your domain)
  Phase 4: Frontend Room State page (your domain)
  Phase 5: Frontend Room Profile page (shared)

### Next Action
Start Phase 1: Room Profile
- Create branch: feat/room-profile
- Schema: add Room.adminNotes
- Create room-profile/ module (Controller/Service/Repository)
- Coordinate with teammate on schema change before db:push

---

## 2026-05-14 — Phase 1 Complete (Session 2)

### Schema Sync Issue
- Attempted `prisma db push` to add adminNotes/externalListingId → DB had extra tables from a Google Sheets migration phase
- Fix: ran `prisma db pull` first to sync, then re-added our 2 fields additively, then ran `prisma db push`
- Note: 那批老表（Listing、ReservationRaw 等）是之前迁移阶段的遗留物，不属于当前活跃开发，忽略。双方现在共同基于 Property → Unit → Room → ListingUrl 开发。

### Phase 1 Implementation (all files created and tested)

**Backend:**
- `prisma/schema.prisma`: added `adminNotes String?` to Room, `externalListingId String?` to ListingUrl ✅
- `src/utils/ics.js`: added `extractICSUid()` + uid field in event parser (backwards compatible) ✅
- `src/room-profile/RoomProfileRepository.js`: pure DB layer ✅
- `src/room-profile/RoomProfileService.js`: business logic, live ICS fetch, Airbnb link generation ✅
- `src/room-profile/RoomProfileController.js`: HTTP layer ✅
- `src/index.js`: 6 new routes added before error handler ✅

**Frontend:**
- Installed vue-router@4 ✅
- `src/router/index.js`: 3 routes (/, /admin, /rooms/:id) ✅
- `src/main.js`: added .use(router) ✅
- `src/App.vue`: replaced manual nav with RouterLink + RouterView ✅
- `src/views/RoomProfile.vue`: full profile page ✅
  - Sections: Current Status badge, Active Reservation (with Airbnb reservation link), Calendar Links management, Admin Notes editor, System Note (read-only)
- `src/views/Dashboard.vue`: room cells now clickable → navigate to /rooms/:id ✅

### Test Results
- `GET /api/rooms/cmp3t3onm0003cevohpqwt6nm/profile` → returns name, status, 1 active URL, live reservation with checkIn date and Airbnb link ✅
- adminNotes column confirmed live in DB ✅
- Airbnb listing links (listingPage, hostManagePage) generated from externalListingId ✅
- Live ICS fetch on profile load: current reservation with confirmation code → reservationLink ✅

### Errors Encountered
| Error | Cause | Fix |
|---|---|---|
| `prisma db push` wants to drop 14 tables | Local schema was behind DB (teammate added tables) | `prisma db pull` first, then add our fields, then push |
| adminNotes field missing from Prisma client | Client not regenerated after pull | `prisma generate` |

### Current State
- Phase 1: ✅ COMPLETE — all endpoints live, frontend navigable
- Schema: 22 models in DB, our 2 new fields applied
- Next: Phase 2 (Reservation Snapshot Pipeline) — need to decide naming to avoid confusion with teammate's existing ReservationRaw/ReservationHistory tables

---

## 2026-05-14 — Planning Files Sync (End of Session 2)

### Sync Summary
- Branch: `codex/room-details-enhancements` — up to date with remote
- Commit: `c310c3b enhance room details listing management` (21 files, +1735/-94)
- `findings.md` updated to reflect current post-Phase-1 code state (was stale, described pre-Phase-1 baseline)
- `task_plan.md` current — Phase 1 marked COMPLETE, Phases 2–5 pending
- `progress.md` current

### Verified Current Structure
- Backend: `room-profile/` MVC module live, `utils/ics.js` uid support added
- Frontend: vue-router installed, 3 routes, RoomProfile.vue added, Dashboard cells clickable
- Schema active models: Property, Unit, Room (+adminNotes), ListingUrl (+listingId), BookingRecord
- All 6 room profile API endpoints tested and working

### Ready for Phase 2
Next session: start `feat/room-state-pipeline` branch
- Verify DB for naming conflicts (ReservationRaw/History naming)
- Add Phase 2 schema (ReservationRaw + ReservationHistory)
- Create `backend/src/room-state/` module

---

## 2026-05-15 — Code Cleanup + UI Redesign (Session 3)

### Dead Code Removed
- `externalListingId` — was a planned field name that was never implemented; remote schema uses `listingId` instead
- Removed 3 stale comments in RoomProfileService.js, Dashboard.vue, RoomProfile.vue that referenced the old name
- Updated all planning files to use correct `listingId` terminology

### UI Design System — Warm Paper Aesthetic
Global style overhaul across 6 files. No functional logic changed.

**New design tokens (`frontend/src/style.css`):**
- Fonts: Playfair Display 700 (headings) + Lato 400/700 (body) via Google Fonts
- CSS variable system: `--ink`, `--ink-2`, `--ink-3`, `--parchment`, `--surface`, `--surface-2`, `--linen`, `--linen-2`
- Status variables: `--s-airbnb-*` (terracotta), `--s-booking-*` (steel blue), `--s-longterm-*` (walnut), `--s-error-*` (clay red), `--s-cleaned-*` (sage green)
- Shadow + radius tokens
- Removed Vite template boilerplate (1126px centering, .hero, #next-steps, etc.)

**Per-file changes:**
- `App.vue`: "AirPMS" brand in Playfair Display, 52px nav, active link underline (not filled pill)
- `Dashboard.vue`: property title → Playfair on warm surface-2 bg; room cells → 3px left status stripe; all hardcoded hex → CSS vars
- `RoomProfile.vue`: status pills use warm palette; panels with shadow-xs; all hardcoded hex → CSS vars
- `AdminPanel.vue`: all hardcoded hex → CSS vars
- `index.html`: title "AirPMS", font preconnect links

### Current Uncommitted Files
7 modified: RoomProfileService.js, index.html, App.vue, style.css, AdminPanel.vue, Dashboard.vue, RoomProfile.vue
3 untracked: findings.md, progress.md, task_plan.md

### Next
- Ready to commit UI redesign changes
- Then start Phase 2: `feat/room-state-pipeline` branch
