<script setup>
import { onMounted, ref } from "vue";
import api from "../api";
import RoomDetailPanel from "../components/RoomDetailPanel.vue";

const properties = ref([]);
const loading = ref(false);
const selectedRoomContext = ref(null);
const dashboardMode = ref("leasing");

function getRoomNumber(roomName) {
  const match = String(roomName || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function isThreeDigitRoom(room) {
  const num = getRoomNumber(room.name);
  return num >= 100 && num <= 999;
}

function allRoomsAreThreeDigit(rooms) {
  if (!rooms.length) return false;
  return rooms.every(isThreeDigitRoom);
}

function sortRooms(rooms) {
  return [...rooms].sort((a, b) => {
    const numA = getRoomNumber(a.name);
    const numB = getRoomNumber(b.name);
    if (numA !== null && numB !== null) return numA - numB;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function sortUnits(units) {
  return [...(units || [])].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

function chunkRooms(rooms, size = 8) {
  const result = [];
  for (let i = 0; i < rooms.length; i += size) {
    result.push(rooms.slice(i, i + size));
  }
  return result;
}

function buildUnitRows(unit) {
  const rooms = sortRooms(unit.rooms || []);

  if (!rooms.length) {
    return [{ unit, rooms: [], type: "unitOnly" }];
  }

  if (allRoomsAreThreeDigit(rooms)) {
    const floorMap = {};
    for (const room of rooms) {
      const floor = Math.floor(getRoomNumber(room.name) / 100);
      if (!floorMap[floor]) floorMap[floor] = [];
      floorMap[floor].push(room);
    }
    return Object.keys(floorMap)
      .sort((a, b) => Number(a) - Number(b))
      .map((floor) => ({ unit, floor, rooms: sortRooms(floorMap[floor]), type: "floorGroup" }));
  }

  return chunkRooms(rooms, 8).map((roomGroup, index) => ({
    unit,
    rooms: roomGroup,
    rowIndex: index,
    type: "normalGroup",
  }));
}

function statusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("airbnb rented")) return "airbnb-rented";
  if (value.includes("booking.com rented")) return "booking-rented";
  if (value === "vacant") return "vacant";
  if (value.includes("long term")) return "long-term";
  if (value.includes("rented")) return "rented";
  if (value.includes("available")) return "available";
  if (value.includes("occupied")) return "occupied";
  if (value.includes("maintenance")) return "maintenance";
  if (value.includes("offline")) return "offline";
  if (value.includes("inactive")) return "inactive";
  if (value.includes("no ics")) return "no-ics";
  if (value.includes("http")) return "error";
  if (value.includes("not ics")) return "error";
  if (value.includes("error")) return "error";
  return "default";
}

function hasListingUrls(item) {
  return Boolean(item.listingUrls?.length);
}

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

function cleaningStatusClass(status) {
  const v = String(status || "").toLowerCase().replace(/[\s_-]/g, "");
  if (v === "cleaned") return "cleaned";
  if (v === "dirty") return "dirty";
  if (v === "needsetup") return "need-setup";
  if (v === "needspiff") return "need-spiff";
  if (v === "occupied") return "occupied";
  return "under-pipeline";
}

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

function selectRoom(property, unit, room) {
  selectedRoomContext.value = { property, unit, room };
}

function closeRoomDetails() {
  selectedRoomContext.value = null;
}

async function loadDashboard() {
  loading.value = true;
  try {
    const res = await api.get("/dashboard/inventory");
    properties.value = res.data;
  } catch (error) {
    console.error("Failed to load dashboard", error);
  } finally {
    loading.value = false;
  }
}

onMounted(loadDashboard);
</script>

<template>
  <div class="dashboard-page">
    <RoomDetailPanel
      v-if="selectedRoomContext"
      :property="selectedRoomContext.property"
      :unit="selectedRoomContext.unit"
      :initial-room="selectedRoomContext.room"
      @close="closeRoomDetails"
    />

    <template v-else>
      <div class="page-header">
        <div>
          <h1>AirPMS Inventory Dashboard</h1>
          <p>Property / Unit / Room inventory overview</p>
        </div>

        <div class="header-right">
          <button
            class="mode-toggle-button"
            type="button"
            @click="dashboardMode = isRoomStatusMode() ? 'leasing' : 'roomStatus'"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M1 5h10M8 2l3 3-3 3M15 11H5M8 8l-3 3 3 3"/>
            </svg>
            {{ isRoomStatusMode() ? "Room Status" : "Leasing Occupancy" }}
          </button>
          <button class="secondary-button" @click="loadDashboard" :disabled="loading">
            Refresh
          </button>
        </div>
      </div>

      <div v-if="loading" class="loading">Loading inventory...</div>

      <div v-for="property in properties" :key="property.id" class="property-card">
        <div class="property-title">{{ property.name }}</div>

        <div class="inventory-table">
          <template v-for="unit in sortUnits(property.units)" :key="unit.id">
            <div
              v-for="(row, rowIndex) in buildUnitRows(unit)"
              :key="`${unit.id}-${rowIndex}`"
              class="inventory-row"
            >
              <div
                class="unit-cell"
                :class="[rowIndex > 0 ? 'muted' : '', rowIndex === 0 ? unitCellClass(unit) : '']"
                :title="rowIndex === 0 ? unit.note || '' : ''"
              >
                <div v-if="rowIndex === 0">
                  <div class="unit-name">{{ unit.name }}</div>
                  <div v-if="hasListingUrls(unit)" class="unit-status">
                    {{ unitDisplayStatus(unit) }}
                  </div>
                </div>
              </div>

              <div
                v-if="row.type === 'unitOnly'"
                class="room-cell empty-room-cell"
                :class="unitCellClass(unit)"
                :title="unit.note || ''"
              >
                <div class="room-name">Whole Unit / No Rooms</div>
                <div v-if="hasListingUrls(unit)" class="room-status">
                  {{ unitDisplayStatus(unit) }}
                </div>
              </div>

              <button
                v-for="room in row.rooms"
                :key="room.id"
                class="room-cell room-button"
                :class="roomCellClass(room)"
                :title="room.note || ''"
                type="button"
                @click="selectRoom(property, unit, room)"
              >
                <span class="room-name">{{ room.name }}</span>
                <span class="room-status">{{ roomDisplayStatus(room) }}</span>
              </button>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard-page {
  padding: 28px;
  background: var(--parchment);
  min-height: calc(100vh - 52px);
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 28px;
}

.page-header h1 { font-size: 26px; letter-spacing: -0.4px; }

.page-header p {
  margin-top: 4px;
  color: var(--ink-3);
  font-size: 14px;
}

.page-header button {
  padding: 8px 18px;
  border: none;
  background: var(--ink);
  color: var(--parchment);
  border-radius: var(--r-sm);
  cursor: pointer;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.02em;
  transition: opacity 0.15s;
}

.page-header button:hover { opacity: 0.85; }
.page-header button:disabled { opacity: 0.45; cursor: not-allowed; }

.secondary-button { background: var(--ink-2) !important; }

.loading { margin-bottom: 16px; color: var(--ink-3); font-size: 14px; }

.property-card {
  background: var(--surface);
  border-radius: var(--r-lg);
  margin-bottom: 24px;
  border: 1px solid var(--linen);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.property-title {
  padding: 16px 22px;
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: var(--ink);
  background: var(--surface-2);
  border-bottom: 1px solid var(--linen);
}

.inventory-table { width: 100%; overflow-x: auto; }

.inventory-row {
  display: flex;
  min-height: 60px;
  border-bottom: 1px solid var(--linen);
}

.inventory-row:last-child { border-bottom: none; }

.unit-cell {
  width: 190px;
  min-width: 190px;
  padding: 10px 14px;
  border-right: 1px solid var(--linen);
  background: var(--surface-2);
  display: flex;
  align-items: center;
}

.unit-cell.muted { color: transparent; background: var(--parchment); }

.unit-name { font-weight: 700; font-size: 13px; color: var(--ink); }
.unit-status { font-size: 11px; color: var(--ink-2); margin-top: 3px; font-weight: 700; }

.room-cell {
  width: 130px;
  min-width: 130px;
  padding: 10px 10px 10px 13px;
  border-right: 1px solid var(--linen);
  background: var(--surface);
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  transition: background 0.15s;
}

.room-cell::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--linen);
  transition: background 0.15s;
}

.room-button { border-top: none; border-bottom: none; border-left: none; text-align: left; font: inherit; cursor: pointer; }
.room-button:hover { background: var(--surface-2); }
.room-button:focus-visible { outline: 2px solid var(--ink); outline-offset: -2px; }

.room-name { font-weight: 700; font-size: 13px; color: var(--ink); }
.room-status { font-size: 11px; color: var(--ink-2); margin-top: 3px; }

.empty-room-cell { color: var(--ink-3); font-style: italic; width: 260px; min-width: 260px; }

/* Leasing status colors */
.room-cell.airbnb-rented, .unit-cell.airbnb-rented { background: var(--s-airbnb-bg); }
.room-cell.airbnb-rented::before { background: var(--s-airbnb-ink); }
.room-cell.airbnb-rented .room-name, .room-cell.airbnb-rented .room-status { color: var(--s-airbnb-ink); }
.unit-cell.airbnb-rented .unit-name, .unit-cell.airbnb-rented .unit-status { color: var(--s-airbnb-ink); }

.room-cell.booking-rented, .unit-cell.booking-rented,
.room-cell.rented, .unit-cell.rented { background: var(--s-booking-bg); }
.room-cell.booking-rented::before, .room-cell.rented::before { background: var(--s-booking-ink); }
.room-cell.booking-rented .room-name, .room-cell.booking-rented .room-status,
.room-cell.rented .room-name, .room-cell.rented .room-status { color: var(--s-booking-ink); }
.unit-cell.booking-rented .unit-name, .unit-cell.booking-rented .unit-status { color: var(--s-booking-ink); }

.room-cell.long-term, .unit-cell.long-term { background: var(--s-longterm-bg); }
.room-cell.long-term::before { background: var(--s-longterm-ink); }
.room-cell.long-term .room-name, .room-cell.long-term .room-status { color: var(--s-longterm-ink); }
.unit-cell.long-term .unit-name, .unit-cell.long-term .unit-status { color: var(--s-longterm-ink); }

.room-cell.vacant, .unit-cell.vacant,
.room-cell.available, .unit-cell.available { background: var(--surface); }

.room-cell.error, .unit-cell.error,
.room-cell.maintenance, .unit-cell.maintenance,
.room-cell.offline, .unit-cell.offline,
.room-cell.inactive, .unit-cell.inactive,
.room-cell.no-ics, .unit-cell.no-ics,
.room-cell.occupied, .unit-cell.occupied { background: var(--s-error-bg); }

.room-cell.error::before, .room-cell.maintenance::before,
.room-cell.offline::before, .room-cell.inactive::before,
.room-cell.no-ics::before, .room-cell.occupied::before { background: var(--s-error-ink); }

.room-cell.error .room-name, .room-cell.maintenance .room-name,
.room-cell.error .room-status { color: var(--s-error-ink); }

/* Header toggle */
.header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

.mode-toggle-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  border: 1px solid var(--linen-2);
  border-radius: var(--r-sm);
  background: var(--surface);
  color: var(--ink);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.mode-toggle-button svg {
  width: 14px; height: 14px; flex-shrink: 0;
  fill: none; stroke: var(--ink-2); stroke-width: 1.8;
  stroke-linecap: round; stroke-linejoin: round;
  transition: stroke 0.15s;
}

.mode-toggle-button:hover { background: var(--surface-2); border-color: var(--ink); }
.mode-toggle-button:hover svg { stroke: var(--ink); }

/* Cleaning status colors */
.room-cell.cleaned, .unit-cell.cleaned { background: var(--s-cleaned-bg); }
.room-cell.cleaned::before { background: var(--s-cleaned-ink); }
.room-cell.cleaned .room-name, .room-cell.cleaned .room-status,
.unit-cell.cleaned .unit-name, .unit-cell.cleaned .unit-status { color: var(--s-cleaned-ink); }

.room-cell.dirty, .unit-cell.dirty { background: var(--s-error-bg); }
.room-cell.dirty::before { background: var(--s-error-ink); }
.room-cell.dirty .room-name, .room-cell.dirty .room-status,
.unit-cell.dirty .unit-name, .unit-cell.dirty .unit-status { color: var(--s-error-ink); }

.room-cell.need-setup, .unit-cell.need-setup { background: #fde8cc; }
.room-cell.need-setup::before { background: #b56a00; }
.room-cell.need-setup .room-name, .room-cell.need-setup .room-status,
.unit-cell.need-setup .unit-name, .unit-cell.need-setup .unit-status { color: #b56a00; }

.room-cell.need-spiff, .unit-cell.need-spiff { background: #fef3c7; }
.room-cell.need-spiff::before { background: #92700a; }
.room-cell.need-spiff .room-name, .room-cell.need-spiff .room-status,
.unit-cell.need-spiff .unit-name, .unit-cell.need-spiff .unit-status { color: #92700a; }

.room-cell.under-pipeline, .unit-cell.under-pipeline { background: #eaeff4; }
.room-cell.under-pipeline::before { background: #6a8898; }
.room-cell.under-pipeline .room-name, .room-cell.under-pipeline .room-status,
.unit-cell.under-pipeline .unit-name, .unit-cell.under-pipeline .unit-status { color: #5a7a8a; }
</style>
