<script setup>
import { ref, onMounted } from "vue";
import api from "../api";

const properties = ref([]);
const loading = ref(false);
const syncingIcs = ref(false);
const syncMessage = ref("");

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
  return [...(units || [])].sort((a, b) => {
    return String(a.name || "").localeCompare(String(b.name || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
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
      const roomNumber = getRoomNumber(room.name);
      const floor = Math.floor(roomNumber / 100);

      if (!floorMap[floor]) floorMap[floor] = [];
      floorMap[floor].push(room);
    }

    return Object.keys(floorMap)
      .sort((a, b) => Number(a) - Number(b))
      .map((floor) => ({
        unit,
        floor,
        rooms: sortRooms(floorMap[floor]),
        type: "floorGroup",
      }));
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

async function syncIcs() {
  const password = window.prompt("Enter admin password:");

  if (!password) return;

  syncingIcs.value = true;
  syncMessage.value = "";

  try {
    const res = await api.post("/admin/sync-ics", {
      password,
    });

    syncMessage.value = "ICS sync completed";
    console.log("ICS sync result:", res.data);

    await loadDashboard();
  } catch (error) {
    console.error("Failed to sync ICS", error);

    if (error.response?.status === 401) {
      syncMessage.value = "Invalid password";
    } else {
      syncMessage.value = "ICS sync failed";
    }
  } finally {
    syncingIcs.value = false;
  }
}

onMounted(loadDashboard);
</script>

<template>
  <div class="dashboard-page">
    <div class="page-header">
      <div>
        <h1>AirPMS Inventory Dashboard</h1>
        <p>Property / Unit / Room inventory overview</p>
      </div>

      <div>
        <div class="header-actions">
          <button
            class="secondary-button"
            @click="loadDashboard"
            :disabled="loading || syncingIcs"
          >
            Refresh
          </button>

          <button
            @click="syncIcs"
            :disabled="loading || syncingIcs"
          >
            {{ syncingIcs ? "Syncing..." : "Sync ICS" }}
          </button>
        </div>

        <div
          v-if="syncMessage"
          class="sync-message"
        >
          {{ syncMessage }}
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">
      Loading inventory...
    </div>

    <div
      v-for="property in properties"
      :key="property.id"
      class="property-card"
    >
      <div class="property-title">
        {{ property.name }}
      </div>

      <div class="inventory-table">
        <template
          v-for="unit in sortUnits(property.units)"
          :key="unit.id"
        >
          <div
            v-for="(row, rowIndex) in buildUnitRows(unit)"
            :key="`${unit.id}-${rowIndex}`"
            class="inventory-row"
          >
            <div
              class="unit-cell"
              :class="[
                rowIndex > 0 ? 'muted' : '',
                rowIndex === 0 ? statusClass(unit.status) : '',
              ]"
              :title="rowIndex === 0 ? unit.note || '' : ''"
            >
              <div v-if="rowIndex === 0">
                <div class="unit-name">
                  {{ unit.name }}
                </div>

                <div
                  v-if="unit.url"
                  class="unit-status"
                >
                  {{ unit.status }}
                </div>
              </div>
            </div>

            <div
              v-if="row.type === 'unitOnly'"
              class="room-cell empty-room-cell"
              :class="statusClass(unit.status)"
              :title="unit.note || ''"
            >
              <div class="room-name">
                Whole Unit / No Rooms
              </div>

              <div
                v-if="unit.url"
                class="room-status"
              >
                {{ unit.status }}
              </div>
            </div>

            <div
              v-for="room in row.rooms"
              :key="room.id"
              class="room-cell"
              :class="statusClass(room.status)"
              :title="room.note || ''"
            >
              <div class="room-name">
                {{ room.name }}
              </div>

              <div class="room-status">
                {{ room.status }}
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  padding: 24px;
  background: #f7f8fa;
  min-height: 100vh;
  font-family: Arial, sans-serif;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22px;
}

.page-header h1 {
  font-size: 24px;
  margin: 0;
  color: #111827;
}

.page-header p {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.page-header button {
  padding: 8px 16px;
  border: none;
  background: #111827;
  color: white;
  border-radius: 6px;
  cursor: pointer;
}

.page-header button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-button {
  background: #6b7280 !important;
}

.sync-message {
  font-size: 12px;
  color: #6b7280;
  margin-top: 6px;
  text-align: right;
}

.loading {
  margin-bottom: 16px;
  color: #666;
}

.property-card {
  background: white;
  border-radius: 10px;
  margin-bottom: 24px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.property-title {
  padding: 14px 18px;
  font-weight: 700;
  background: #111827;
  color: white;
}

.inventory-table {
  width: 100%;
  overflow-x: auto;
}

.inventory-row {
  display: flex;
  min-height: 64px;
  border-bottom: 1px solid #e5e7eb;
}

.inventory-row:last-child {
  border-bottom: none;
}

.unit-cell {
  width: 190px;
  min-width: 190px;
  padding: 10px 12px;
  border-right: 1px solid #e5e7eb;
  background: #f3f4f6;
  font-weight: 600;
  display: flex;
  align-items: center;
}

.unit-cell.muted {
  color: transparent;
  background: #f9fafb;
}

.unit-name {
  font-weight: 700;
  font-size: 14px;
}

.unit-status {
  font-size: 12px;
  color: #374151;
  margin-top: 4px;
  font-weight: 500;
}

.room-cell {
  width: 130px;
  min-width: 130px;
  padding: 8px;
  border-right: 1px solid #e5e7eb;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.room-name {
  font-weight: 700;
  font-size: 14px;
  color: #111827;
}

.room-status {
  font-size: 12px;
  color: #374151;
  margin-top: 4px;
}

.empty-room-cell {
  color: #6b7280;
  font-style: italic;
  width: 260px;
  min-width: 260px;
}

.room-cell.long-term,
.unit-cell.long-term {
  background: #f3f4f6;
}

.room-cell.airbnb-rented,
.unit-cell.airbnb-rented,
.room-cell.booking-rented,
.unit-cell.booking-rented,
.room-cell.rented,
.unit-cell.rented {
  background: #dcfce7;
}

.room-cell.vacant,
.unit-cell.vacant,
.room-cell.available,
.unit-cell.available {
  background: #ffffff;
}

.room-cell.error,
.unit-cell.error,
.room-cell.maintenance,
.unit-cell.maintenance,
.room-cell.offline,
.unit-cell.offline,
.room-cell.inactive,
.unit-cell.inactive,
.room-cell.no-ics,
.unit-cell.no-ics,
.room-cell.occupied,
.unit-cell.occupied {
  background: #fee2e2;
}
</style>