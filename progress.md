# AirPMS Progress Log

---

## 2026-05-15 — Dashboard View Toggle Planning

### User Request

User wants the current Dashboard room grid to support a toggle between:

- **Leasing Occupancy** — current view, showing rented/vacant/maintenance occupancy.
- **Room Status** — new view, showing cleaning/operations status first.

Room Status should later support scheduling helper fields such as:

- dirty days
- days until next check-in
- cleaning pressure

### Planning Method

Used `planning-with-files`.

Files updated:

- `task_plan.md`
- `findings.md`
- `progress.md`

### Findings

- Current Dashboard already displays leasing occupancy through `room.status` and `unit.AvailabilityStatus`.
- Prisma schema already has `Room.cleaningStatus` and `Unit.cleaningStatus`.
- `GET /dashboard/inventory` should already return those fields because Prisma includes scalar fields by default.
- First version can be frontend-only.
- No database migration is needed for the first version.
- Room detail panel already shows both Cleaning and Leasing, so it should not be replaced.

### Plan Status

Planned, not implemented.

### Errors Encountered

No errors. Planning only.

---

## 2026-05-15 — Dashboard View Toggle Implementation (Session 2)

### Work Done

Implemented all phases from `task_plan.md` in `frontend/src/views/Dashboard.vue`:

- Added `dashboardMode` ref (default: `"leasing"`) and `dashboardModes` metadata array.
- Added helpers: `isRoomStatusMode()`, `roomDisplayStatus(room)`, `unitDisplayStatus(unit)`.
- Added `cleaningStatusClass(status)` — normalizes Prisma enum keys by stripping spaces/dashes before matching.
- Added `roomCellClass(room)` and `unitCellClass(unit)` — route to correct color mapper.
- Rewired room cell labels and class bindings to use new helpers.
- Added cleaning status CSS classes: `.cleaned`, `.dirty`, `.need-setup`, `.need-spiff`, `.under-pipeline`.
- `npm run build` passed with 0 errors.

### Errors Encountered

- **`externalListingId` dead code**: Field appeared in planning files and comments but was never implemented. Remote schema uses `listingId`. Removed 3 stale comments from `RoomProfileService.js`, `Dashboard.vue`, `RoomProfile.vue`, and updated planning files.

---

## 2026-05-16 — Toggle Button Design Iteration (Session 3)

### Work Done

Iterated on the view toggle button UI based on user feedback:

- **Iteration 1**: Two-button segmented control (`Leasing Occupancy | Room Status`). User feedback: "我不想要两个按钮，我只要一个切换按钮".
- **Iteration 2**: Single button labeled with destination view. User feedback: "我觉得你边上加的那个有点多余".
- **Iteration 3 (final)**: Single `.mode-toggle-button` with ⇄ SVG icon + current view name. Button shows current mode; click toggles to opposite.

### Phase Status

All 6 phases in `task_plan.md` marked complete ✅.

### Errors Encountered

No errors in Session 3.

---

## 2026-05-18 — Upcoming Reservations Feature + Bug Fixes (Session 4)

### Work Done

- `backend/src/utils/ics.js`: Added `extractGuestId(uid)` and `extractReservationCode(description)` to parse Airbnb ICS events. Added `deriveRoomStatus()` function (extracted from `getRecentStayFromICS` logic). Exported `deriveRoomStatus`.
- `backend/src/services/syncIcsStatusService.js`: Refactored to use `fetchAndParseEvents()` + `deriveRoomStatus()`. Added `upsertBookingRecords()` — upserts `BookingRecord` rows for upcoming events during sync.
- `backend/src/room-profile/RoomProfileService.js`: Renamed `fetchCurrentReservation` → `fetchUpcomingReservations`. Now returns an array of reservations with `guestId`, `reservationCode`, `isCurrent` flag.
- `frontend/src/views/Dashboard.vue`: Added "Reservations" section in room detail panel. Shows Current/Upcoming badge per reservation. guestId is plain text (not a link). reservationCode links to Airbnb host reservation details.
- `frontend/src/router/index.js` + `RoomProfile.vue`: Deleted standalone room profile page and route; merged into Dashboard side panel.

### Bugs Fixed

- Backend process was suspended (T state) causing dashboard to hang on "Loading inventory". Resolved by resuming with `kill -CONT`.
- API was returning `currentReservation` but frontend expected `upcomingReservations` — required backend restart to pick up new code.
- guestId link to `airbnb.com/users/show/` removed (URL doesn't work for hosts). Now plain text.
- Section title "Upcoming Reservations" was misleading — current guests also appeared. Fixed by adding `isCurrent` badge.

### Errors Encountered

No implementation errors. All bugs were runtime/environment issues.

---

## 2026-05-18 — Code Review (Session 5)

### Scope

Full review of all uncommitted changes + key backend/frontend files.

### Critical Issues Found

See `findings.md` for full detail.

1. **Dead code duplication** (`ics.js`): `getRecentStayFromICS` and `deriveRoomStatus` do nearly identical work. `getRecentStayFromICS` is now unused by sync service but still exported.
2. **No fetch timeout**: `fetchAndParseEvents` and `fetchUpcomingReservations` have no timeout. A hanging ICS URL blocks the entire sync/profile indefinitely.
3. **N+1 DB queries** in `upsertBookingRecords`: Sequential `findFirst` + `update/create` for each event. 10 upcoming events = up to 20 sequential queries per room.
4. **Unit listings don't upsert booking records**: `upsertBookingRecords` is called only for room listings, silently skipped for unit-level listings.

### Medium Issues Found

5. **~310 lines of commented-out dead code** at top of `index.js`.
6. **`parseICSEventsBySource` unused**: Defined in `ics.js` but not called by new sync code.
7. **Booking.com rooms never show reservations in profile**: `fetchUpcomingReservations` only fetches for Airbnb primary URL.
8. **Dashboard.vue is 1573 lines**: Monolithic SFC, hard to maintain.

### Minor Issues Found

9. Inconsistent indentation in `ics.js` (4-space at top level vs 2-space in some blocks).
10. No auth on admin/management routes.
11. No loading indicator while `refreshSelectedRoom` fetches room profile.
12. No tests anywhere in the project.
