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

Next recommended implementation branch:

```bash
git switch -c codex/dashboard-view-toggle
```

Next recommended command before coding:

```bash
git status -sb
```

### Pending Work

1. Add Dashboard mode state.
2. Add segmented toggle UI.
3. Add display helpers for leasing vs room status.
4. Add cleaning status color classes.
5. Verify room click/details still works.
6. Run frontend build.

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

Final template:
```vue
<button class="mode-toggle-button" type="button"
  @click="dashboardMode = isRoomStatusMode() ? 'leasing' : 'roomStatus'">
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M1 5h10M8 2l3 3-3 3M15 11H5M8 8l-3 3 3 3"/>
  </svg>
  {{ isRoomStatusMode() ? "Room Status" : "Leasing Occupancy" }}
</button>
```

### Phase Status

All 6 phases in `task_plan.md` marked complete ✅.

### Errors Encountered

No errors in Session 3.
