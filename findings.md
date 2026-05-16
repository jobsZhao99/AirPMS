# AirPMS Findings — Dashboard View Toggle

Updated: 2026-05-15

---

## Request Summary

The selected Dashboard region currently shows **Leasing Occupancy**. The user wants a toggle so the same room matrix can switch between:

1. **Leasing Occupancy** — rented/vacant/maintenance style occupancy view.
2. **Room Status** — cleaning/operations status view.

The user explicitly described Room Status as cleaning status first, with future expansion for fields such as:

- how many days dirty
- days until next check-in
- scheduling/cleaning pressure

---

## Current Frontend Findings

File: `frontend/src/views/Dashboard.vue`

Current behavior:

- `properties` loads from `GET /dashboard/inventory`.
- Room cells display `room.status`.
- Room cell color uses `statusClass(room.status)`.
- Unit-level display uses `unitStatus(unit)`, which returns:

```js
unit.AvailabilityStatus || unit.status || "Available"
```

- Clicking a room calls `selectRoom(property, unit, room)` and opens the existing details panel.
- The details panel already shows both:
  - `selectedRoom.cleaningStatus`
  - `selectedRoom.leasingStatus`

Conclusion:

- The Dashboard is already close to supporting the requested toggle.
- The first version can be done by adding a mode state and display/class helper functions.
- Room details should not be replaced or redesigned for this task.

---

## Current Backend Findings

File: `backend/src/index.js`

Current endpoint:

```js
GET /dashboard/inventory
```

It returns properties with:

- units
- unit listing URLs
- rooms
- room listing URLs

Because Prisma returns all scalar fields by default, room/unit objects should already include:

- `Room.status`
- `Room.cleaningStatus`
- `Room.leasingStatus`
- `Unit.AvailabilityStatus`
- `Unit.cleaningStatus`

Conclusion:

- No backend endpoint change is required for the first toggle version.

---

## Current Schema Findings

File: `backend/prisma/schema.prisma`

Relevant fields:

```prisma
enum CleaningStatus {
  Cleaned
  Dirty
  UnderPipeline
  NeedSetup     @map("Need Setup")
  NeedSpiff     @map("Need Spiff")
  Occupied
}
```

```prisma
model Unit {
  AvailabilityStatus String         @default("Available")
  cleaningStatus     CleaningStatus @default(UnderPipeline)
  leasingStatus      String         @default("Vacant")
}
```

```prisma
model Room {
  status         String         @default("Available")
  cleaningStatus CleaningStatus @default(UnderPipeline)
  leasingStatus  String         @default("Vacant")
}
```

Conclusion:

- Current schema already separates occupancy and cleaning state.
- First version should not need Prisma migration.

---

## Domain Clarification

### Leasing Occupancy

Meaning:

- Is this room rented or vacant right now?
- Is the room Airbnb rented, Booking.com rented, long-term, vacant, maintenance, offline, or error?

Primary fields:

- `Room.status`
- `Unit.AvailabilityStatus`

### Room Status

Meaning:

- What operational/cleaning state is this room in?
- Is it cleaned, dirty, under pipeline, need setup, need spiff, or occupied?

Primary fields:

- `Room.cleaningStatus`
- `Unit.cleaningStatus`

Future fields:

- reservation history
- cleaning assignment
- dirty duration
- next check-in pressure

---

## Implementation Direction

Recommended first version:

- Frontend-only.
- Add a Dashboard toggle.
- Default to `Leasing Occupancy`.
- Keep all current data loading and room detail behavior.
- Add separate cleaning status color mapping.

Recommended future version:

- Add backend-generated room status metadata after reservation history and cleaning assignment logic exist in the PMS backend.

---

## Open Questions

1. UI label language:
   - Current app uses English labels.
   - Recommended toggle labels: `Leasing Occupancy` and `Room Status`.

2. Room Status secondary line:
   - First version can show only the cleaning status.
   - Future version can show `Dirty 3d · Next 5d`.

3. Tooltip behavior:
   - First version can keep existing `room.note`.
   - Future version may show cleaning notes or calculated room status metadata.
