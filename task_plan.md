# AirPMS Dashboard View Toggle Plan

Updated: 2026-05-15
Status: Planned, not implemented

---

## Goal

在现有 Dashboard 的房间矩阵上方新增一个视图切换按钮，让同一套房间格子可以在两个运营视角之间切换：

1. **Leasing Occupancy** — 当前已经存在的出租/占用视角，回答“房间现在是否出租、长期租、Airbnb 租出、空置或维护”。
2. **Room Status** — 新增的清洁/运营状态视角，回答“房间清洁状态是什么，是否 Dirty/Cleaned/Need Setup/Need Spiff，后续还能展示 dirty days 和 next check-in pressure”。

第一版只做轻量前端切换，不改数据库，不改后端同步逻辑。

---

## Current Baseline

Current branch after merge: `master`
Current active Dashboard file: `frontend/src/views/Dashboard.vue`
Current inventory API: `GET /dashboard/inventory`

The inventory API already returns:

- `Room.status` — current leasing/occupancy status from ICS and long-term sync.
- `Room.cleaningStatus` — cleaning/room operation status enum.
- `Room.leasingStatus` — separate leasing label, currently shown in details.
- `Room.note` — system-generated note from sync.
- `Unit.AvailabilityStatus` — current unit-level leasing/occupancy status.
- `Unit.cleaningStatus` — unit-level cleaning/room operation status.

Because these fields already exist, the first version does not need a Prisma migration.

---

## Domain Boundary

| View | Primary Meaning | Reads From | Must Not Write |
|---|---|---|---|
| Leasing Occupancy | Whether room/unit is rented, vacant, long-term, Airbnb, Booking.com, maintenance | `room.status`, `unit.AvailabilityStatus`, `room.note`, `unit.note` | `room.cleaningStatus` |
| Room Status | Cleaning and operations state | `room.cleaningStatus`, `unit.cleaningStatus` | `room.status`, `unit.AvailabilityStatus`, sync-owned notes |

Important: these two concepts are intentionally separate. Do not collapse `room.status` and `room.cleaningStatus` into one field.

---

## Implementation Scope

### In Scope for First Version

- Add a segmented toggle near the Dashboard header:
  - `Leasing Occupancy`
  - `Room Status`
- Default selected mode: `Leasing Occupancy`.
- Keep the current Dashboard layout and room click behavior.
- In Leasing mode:
  - Room cell text and color continue to use `room.status`.
  - Unit cell text and color continue to use `unit.AvailabilityStatus`.
- In Room Status mode:
  - Room cell text and color use `room.cleaningStatus`.
  - Unit / whole-unit cell text and color use `unit.cleaningStatus`.
- Add a separate cleaning status color map so leasing colors do not get overloaded.
- Keep room details page unchanged, except it should still show both Cleaning and Leasing fields.
- Run frontend build after implementation.

### Out of Scope for First Version

- No new database tables.
- No new Prisma migration.
- No change to ICS sync.
- No change to long-term lease sync.
- No Google Sheet logic migration.
- No calculation yet for dirty days, days to next check-in, or cleaning priority.

---

## Files to Modify

### `frontend/src/views/Dashboard.vue`

Main implementation file.

Planned changes:

- Add `dashboardMode` state:

```js
const dashboardMode = ref("leasing");
```

- Add mode metadata:

```js
const dashboardModes = [
  { key: "leasing", label: "Leasing Occupancy" },
  { key: "roomStatus", label: "Room Status" },
];
```

- Add display helpers:

```js
function isRoomStatusMode() {
  return dashboardMode.value === "roomStatus";
}

function roomDisplayStatus(room) {
  return isRoomStatusMode()
    ? room.cleaningStatus || "UnderPipeline"
    : room.status || "Available";
}

function unitDisplayStatus(unit) {
  return isRoomStatusMode()
    ? unit.cleaningStatus || "UnderPipeline"
    : unit.AvailabilityStatus || unit.status || "Available";
}
```

- Add class helpers:

```js
function roomCellClass(room) {
  return isRoomStatusMode()
    ? cleaningStatusClass(roomDisplayStatus(room))
    : statusClass(roomDisplayStatus(room));
}

function unitCellClass(unit) {
  return isRoomStatusMode()
    ? cleaningStatusClass(unitDisplayStatus(unit))
    : statusClass(unitDisplayStatus(unit));
}
```

- Add `cleaningStatusClass(status)` separate from existing `statusClass(status)`.

Suggested mapping:

```js
function cleaningStatusClass(status) {
  const value = String(status || "").toLowerCase();

  if (value.includes("cleaned")) return "cleaned";
  if (value.includes("dirty")) return "dirty";
  if (value.includes("need setup")) return "need-setup";
  if (value.includes("need spiff")) return "need-spiff";
  if (value.includes("occupied")) return "occupied";
  if (value.includes("underpipeline") || value.includes("under pipeline")) return "under-pipeline";

  return "default";
}
```

- Change current cell rendering:

```vue
{{ room.status }}
```

to:

```vue
{{ roomDisplayStatus(room) }}
```

- Change current class binding:

```vue
:class="statusClass(room.status)"
```

to:

```vue
:class="roomCellClass(room)"
```

- Change unit/whole-unit display in the same way.

### `frontend/src/style.css`

Only if shared variables are needed.

Preferred approach: keep most CSS scoped in `Dashboard.vue`. If new colors should be reusable later, add warm-paper variables here.

### No Backend Files in First Version

The API already includes the required fields through Prisma include. No backend change expected.

---

## Phase Plan

### Phase 1 — Baseline Confirmation

Status: complete ✅

Steps:

1. Confirm Dashboard currently loads from `GET /dashboard/inventory`.
2. Confirm returned room objects contain `status` and `cleaningStatus`.
3. Confirm returned unit objects contain `AvailabilityStatus` and `cleaningStatus`.
4. Confirm current room click still opens details.

Expected result:

- No schema or backend blocker.
- Work remains frontend-only.

### Phase 2 — Add Dashboard Mode State

Status: complete ✅

Steps:

1. Add `dashboardMode` and `dashboardModes` to `Dashboard.vue`.
2. Add `isRoomStatusMode()`.
3. Add `roomDisplayStatus(room)` and `unitDisplayStatus(unit)`.
4. Add `roomCellClass(room)` and `unitCellClass(unit)`.
5. Add `cleaningStatusClass(status)`.

Expected result:

- The template can ask one helper for display label and one helper for class.
- Existing leasing behavior remains the default.

### Phase 3 — Add Header Toggle UI

Status: complete ✅

Steps:

1. Add a segmented control near the Dashboard header action area.
2. Use two buttons:
   - `Leasing Occupancy`
   - `Room Status`
3. Bind active button to `dashboardMode`.
4. Keep `Refresh` visible and unchanged.

Expected result:

- User can switch views without leaving Dashboard.
- Refresh still works.

### Phase 4 — Rewire Room and Unit Cells

Status: complete ✅

Steps:

1. Replace room cell label from `room.status` to `roomDisplayStatus(room)`.
2. Replace room cell class from `statusClass(room.status)` to `roomCellClass(room)`.
3. Replace whole-unit cell label from `unitStatus(unit)` to `unitDisplayStatus(unit)`.
4. Replace unit cell class from `statusClass(unitStatus(unit))` to `unitCellClass(unit)`.
5. Keep tooltip as `note` for now. In Room Status mode this can later become cleaning notes or status metadata.

Expected result:

- Leasing mode looks like today.
- Room Status mode uses cleaning state.

### Phase 5 — Add Cleaning Status Styling

Status: complete ✅

Steps:

1. Add CSS styles for:
   - `.room-cell.cleaned`
   - `.room-cell.dirty`
   - `.room-cell.need-setup`
   - `.room-cell.need-spiff`
   - `.room-cell.under-pipeline`
2. Use the existing warm-paper visual style.
3. Keep the left status stripe pattern so the two views feel like the same Dashboard.

Suggested visual meaning:

| Cleaning Status | Color Direction |
|---|---|
| Cleaned | soft green |
| Dirty | red / rose |
| Need Setup | orange |
| Need Spiff | amber |
| UnderPipeline | muted blue-gray |
| Occupied | existing occupied blue |

Expected result:

- Room Status mode is visually distinct and scan-friendly.

### Phase 6 — Verification

Status: complete ✅ (npm run build passed, 0 errors)

Commands:

```bash
cd "/Users/sharkqiqqi/Documents/airPulse/AirPMS/frontend"
npm run build
```

Manual checks:

- Open `http://localhost:5173/`.
- Confirm default mode is `Leasing Occupancy`.
- Confirm rooms still show `Airbnb Rented`, `Long Term`, `Vacant`, etc. in default mode.
- Click `Room Status`.
- Confirm rooms show `Cleaned`, `Dirty`, `UnderPipeline`, etc.
- Click a room and confirm room details still opens.
- Go back and confirm Dashboard still works.
- Click Refresh and confirm the selected view still renders correctly.

Expected result:

- Build passes.
- Existing leasing occupancy behavior is preserved.
- New room status view works without backend changes.

---

## Future Phase — Operational Room Status Metadata

Status: not started

After the first version is stable, add backend-generated metadata for scheduling decisions:

```js
room.roomStatusMeta = {
  dirtyDays: 3,
  nextCheckIn: "2026-05-20",
  daysToNextCheckIn: 5,
  cleaningPriority: "High",
};
```

Potential future display:

```text
Dirty
3d dirty · Next 5d
```

This future phase should come from the Room State pipeline, not from the existing leasing sync. It will likely need reservation history and cleaning assignment data.

---

## Risks and Guardrails

| Risk | Guardrail |
|---|---|
| Accidentally changing leasing behavior | Keep `dashboardMode` default as `leasing`; do not modify sync services |
| Confusing `Room.status` with `Room.cleaningStatus` | Use helper names that clearly say `roomDisplayStatus` and `cleaningStatusClass` |
| Colors becoming misleading | Keep separate class mapper for leasing vs cleaning |
| Room details click breaks | Do not change `selectRoom(property, unit, room)` |
| Backend scope creep | Do not add API or schema changes in first version |

---

## Definition of Done

- Dashboard has a visible two-option toggle.
- Default view matches current Leasing Occupancy display.
- Room Status view displays cleaning status values.
- Unit and whole-unit rows also respond to the toggle.
- Room detail navigation still works.
- `frontend npm run build` passes.
- Planning files updated with implementation progress.

---

## Errors Encountered

No implementation errors yet. Planning only.
