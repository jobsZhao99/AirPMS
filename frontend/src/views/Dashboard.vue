<script setup>
import { ref, onMounted } from "vue";
import api from "../api";

const properties = ref([]);
const loading = ref(false);
const selectedRoomContext = ref(null);

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

function hasListingUrls(item) {
  return Boolean(item.listingUrls?.length);
}

function unitStatus(unit) {
  return unit.AvailabilityStatus || unit.status || "Available";
}

function selectRoom(property, unit, room) {
  selectedRoomContext.value = {
    property,
    unit,
    room,
  };
}

function closeRoomDetails() {
  selectedRoomContext.value = null;
}

function extractAirbnbListingId(url) {
  const match = String(url || "").match(/\/(\d+)\.ics(?:[?#].*)?$/i);

  return match ? match[1] : "";
}

function numericId(value) {
  const text = String(value || "");

  return /^\d+$/.test(text) ? text : "";
}

function airbnbListing(room) {
  return (room.listingUrls || []).find((listing) => {
    return (
      String(listing.channel || "").toLowerCase() === "airbnb" ||
      String(listing.url || "").toLowerCase().includes("airbnb.com") ||
      Boolean(listing.listingId)
    );
  });
}

function airbnbListingId(room) {
  const listing = airbnbListing(room);

  if (!listing) return "";

  return (
    listing.listingId ||
    extractAirbnbListingId(listing.url) ||
    numericId(listing.id)
  );
}

function airbnbLinks(room) {
  const listingId = airbnbListingId(room);

  if (!listingId) {
    return {
      preview: "",
      editListing: "",
      editCalendar: "",
    };
  }

  return {
    preview: `https://www.airbnb.com/rooms/${listingId}`,
    editListing: `https://www.airbnb.com/hosting/listings/editor/${listingId}/details/`,
    editCalendar: `https://www.airbnb.com/multicalendar/${listingId}`,
  };
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
    <div
      v-if="selectedRoomContext"
      class="room-detail-page"
    >
      <button
        class="back-button"
        type="button"
        @click="closeRoomDetails"
      >
        Back
      </button>

      <div class="room-detail-header">
        <div>
          <div class="detail-kicker">
            {{ selectedRoomContext.property.name }} / {{ selectedRoomContext.unit.name }}
          </div>

          <h1>
            {{ selectedRoomContext.room.name }}
          </h1>

          <p>
            {{ selectedRoomContext.room.status }}
          </p>
        </div>

        <div class="airbnb-actions">
          <a
            class="icon-button"
            :class="{ disabled: !airbnbLinks(selectedRoomContext.room).preview }"
            :href="airbnbLinks(selectedRoomContext.room).preview || undefined"
            target="_blank"
            rel="noreferrer"
            aria-label="Preview"
            title="Preview"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </a>

          <a
            class="icon-button"
            :class="{ disabled: !airbnbLinks(selectedRoomContext.room).editListing }"
            :href="airbnbLinks(selectedRoomContext.room).editListing || undefined"
            target="_blank"
            rel="noreferrer"
            aria-label="Edit Listing"
            title="Edit Listing"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </a>

          <a
            class="icon-button"
            :class="{ disabled: !airbnbLinks(selectedRoomContext.room).editCalendar }"
            :href="airbnbLinks(selectedRoomContext.room).editCalendar || undefined"
            target="_blank"
            rel="noreferrer"
            aria-label="Edit Calendar"
            title="Edit Calendar"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <path d="M16 2v4" />
              <path d="M8 2v4" />
              <path d="M3 10h18" />
            </svg>
          </a>
        </div>
      </div>

      <div class="detail-grid">
        <section class="detail-section">
          <h2>Room</h2>

          <dl>
            <div>
              <dt>Property</dt>
              <dd>{{ selectedRoomContext.property.name }}</dd>
            </div>

            <div>
              <dt>Unit</dt>
              <dd>{{ selectedRoomContext.unit.name }}</dd>
            </div>

            <div>
              <dt>Room</dt>
              <dd>{{ selectedRoomContext.room.name }}</dd>
            </div>

            <div>
              <dt>Listing Name</dt>
              <dd>{{ selectedRoomContext.room.listingName || "Not set" }}</dd>
            </div>

            <div>
              <dt>AppFolio Name</dt>
              <dd>{{ selectedRoomContext.room.appfolioName || "Not set" }}</dd>
            </div>

            <div>
              <dt>Cleaning</dt>
              <dd>{{ selectedRoomContext.room.cleaningStatus || "Not set" }}</dd>
            </div>

            <div>
              <dt>Leasing</dt>
              <dd>{{ selectedRoomContext.room.leasingStatus || "Not set" }}</dd>
            </div>
          </dl>
        </section>

        <section class="detail-section">
          <h2>Listings</h2>

          <div
            v-if="selectedRoomContext.room.listingUrls?.length"
            class="listing-list"
          >
            <div
              v-for="listing in selectedRoomContext.room.listingUrls"
              :key="listing.id"
              class="listing-row"
            >
              <div>
                <div class="listing-channel">
                  {{ listing.channel }}
                </div>

                <div class="listing-url">
                  {{ listing.url }}
                </div>
              </div>

              <div class="listing-id">
                {{ listing.listingId || extractAirbnbListingId(listing.url) || "No ID" }}
              </div>
            </div>
          </div>

          <div v-else class="empty-state">
            No listing URLs
          </div>
        </section>

        <section class="detail-section detail-note">
          <h2>Note</h2>

          <p>
            {{ selectedRoomContext.room.note || "No note" }}
          </p>
        </section>
      </div>
    </div>

    <template v-else>
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
            :disabled="loading"
          >
            Refresh
          </button>
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
                  rowIndex === 0 ? statusClass(unitStatus(unit)) : '',
                ]"
                :title="rowIndex === 0 ? unit.note || '' : ''"
              >
                <div v-if="rowIndex === 0">
                  <div class="unit-name">
                    {{ unit.name }}
                  </div>

                  <div
                    v-if="hasListingUrls(unit)"
                    class="unit-status"
                  >
                    {{ unitStatus(unit) }}
                  </div>
                </div>
              </div>

              <div
                v-if="row.type === 'unitOnly'"
                class="room-cell empty-room-cell"
                :class="statusClass(unitStatus(unit))"
                :title="unit.note || ''"
              >
                <div class="room-name">
                  Whole Unit / No Rooms
                </div>

                <div
                  v-if="hasListingUrls(unit)"
                  class="room-status"
                >
                  {{ unitStatus(unit) }}
                </div>
              </div>

              <button
                v-for="room in row.rooms"
                :key="room.id"
                class="room-cell room-button"
                :class="statusClass(room.status)"
                :title="room.note || ''"
                type="button"
                @click="selectRoom(property, unit, room)"
              >
                <span class="room-name">
                  {{ room.name }}
                </span>

                <span class="room-status">
                  {{ room.status }}
                </span>
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

.room-button {
  border-top: none;
  border-bottom: none;
  border-left: none;
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.room-button:hover {
  box-shadow: inset 0 0 0 2px #111827;
}

.room-button:focus-visible {
  outline: 2px solid #111827;
  outline-offset: -2px;
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

.room-detail-page {
  text-align: left;
}

.back-button {
  margin-bottom: 16px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #111827;
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
}

.room-detail-header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
  padding-bottom: 18px;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 18px;
}

.detail-kicker {
  color: #6b7280;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 6px;
}

.room-detail-header h1 {
  margin: 0;
  font-size: 28px;
  color: #111827;
}

.room-detail-header p {
  margin-top: 6px;
  color: #374151;
  font-size: 15px;
}

.airbnb-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.icon-button {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #111827;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.icon-button:hover {
  border-color: #111827;
}

.icon-button.disabled {
  opacity: 0.35;
  pointer-events: none;
}

.icon-button svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(260px, 0.85fr) minmax(320px, 1.15fr);
  gap: 16px;
}

.detail-section {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

.detail-section h2 {
  margin: 0 0 14px;
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}

.detail-section dl {
  display: grid;
  gap: 12px;
  margin: 0;
}

.detail-section dt {
  color: #6b7280;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 2px;
}

.detail-section dd {
  color: #111827;
  font-size: 14px;
  margin: 0;
  overflow-wrap: anywhere;
}

.detail-note {
  grid-column: 1 / -1;
}

.detail-note p {
  white-space: pre-wrap;
  color: #374151;
  font-size: 14px;
}

.listing-list {
  display: grid;
  gap: 10px;
}

.listing-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.listing-channel {
  color: #111827;
  font-size: 14px;
  font-weight: 700;
}

.listing-url {
  color: #6b7280;
  font-size: 12px;
  overflow-wrap: anywhere;
  margin-top: 2px;
}

.listing-id {
  color: #111827;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.empty-state {
  color: #6b7280;
  font-size: 14px;
}

@media (max-width: 760px) {
  .room-detail-header {
    flex-direction: column;
  }

  .airbnb-actions {
    justify-content: flex-start;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .detail-note {
    grid-column: auto;
  }
}
</style>
