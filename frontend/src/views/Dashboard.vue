<script setup>
import { computed, onMounted, ref } from "vue";
import api from "../api";

const properties = ref([]);
const loading = ref(false);
const selectedRoomContext = ref(null);
const detailError = ref("");
const savingDetail = ref(false);

const editingAdminNotes = ref(false);
const adminNotesInput = ref("");

const addingListing = ref(false);
const newListing = ref({ url: "", channel: "", notes: "" });
const editingListingId = ref("");
const listingDraft = ref({ url: "", channel: "", notes: "" });
const listingError = ref("");

const channelOptions = ["Airbnb", "Booking.com", "VRBO", "Unknown"];

const selectedRoom = computed(() => selectedRoomContext.value?.room || null);

const activeListings = computed(() => {
  return (selectedRoom.value?.listingUrls || []).filter((listing) => {
    return String(listing.status || "active").toLowerCase() === "active";
  });
});

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

function resetDetailForms() {
  addingListing.value = false;
  editingListingId.value = "";
  editingAdminNotes.value = false;
  listingError.value = "";
  newListing.value = { url: "", channel: "", notes: "" };
  listingDraft.value = { url: "", channel: "", notes: "" };
}

async function selectRoom(property, unit, room) {
  selectedRoomContext.value = { property, unit, room };
  adminNotesInput.value = room.adminNotes || "";
  resetDetailForms();
  await refreshSelectedRoom();
}

function closeRoomDetails() {
  selectedRoomContext.value = null;
  detailError.value = "";
  resetDetailForms();
}

async function refreshSelectedRoom() {
  if (!selectedRoom.value?.id) return;

  try {
    const res = await api.get(`/api/rooms/${selectedRoom.value.id}/profile`);
    const profile = res.data;

    // 详情页仍以远程现有 UI 为主，只用 profile API 补齐 listing 管理字段。
    selectedRoomContext.value = {
      property: profile.unit?.property || selectedRoomContext.value.property,
      unit: profile.unit || selectedRoomContext.value.unit,
      room: {
        ...selectedRoomContext.value.room,
        ...profile,
      },
    };
    adminNotesInput.value = profile.adminNotes || "";
  } catch (error) {
    console.error("Failed to refresh room profile", error);
    detailError.value = "Room details loaded from dashboard data; management actions may need backend API.";
  }
}

function extractAirbnbListingId(url) {
  const match = String(url || "").match(/\/calendar\/ical\/(\d+)\.ics/i);
  return match ? match[1] : "";
}

function numericId(value) {
  const text = String(value || "");
  return /^\d+$/.test(text) ? text : "";
}

function airbnbListing(room) {
  return (room?.listingUrls || []).find((listing) => {
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

function startEditListing(listing) {
  editingListingId.value = listing.id;
  listingDraft.value = {
    url: listing.url || "",
    channel: listing.channel || "Unknown",
    notes: listing.notes || "",
  };
}

async function saveAdminNotes() {
  if (!selectedRoom.value?.id) return;

  savingDetail.value = true;
  detailError.value = "";

  try {
    await api.patch(`/api/rooms/${selectedRoom.value.id}/admin-notes`, {
      adminNotes: adminNotesInput.value,
    });
    await refreshSelectedRoom();
    editingAdminNotes.value = false;
  } catch (error) {
    console.error("Failed to save admin notes", error);
    detailError.value = "Failed to save admin notes.";
  } finally {
    savingDetail.value = false;
  }
}

async function addListingUrl() {
  if (!selectedRoom.value?.id) return;
  if (!newListing.value.url.trim()) {
    listingError.value = "Please enter a listing URL.";
    return;
  }

  savingDetail.value = true;
  listingError.value = "";

  try {
    // 后端会从 Airbnb ICS URL 提取 ListingUrl.listingId，不新增 externalListingId。
    await api.post(`/api/rooms/${selectedRoom.value.id}/listing-urls`, newListing.value);
    resetDetailForms();
    await refreshSelectedRoom();
  } catch (error) {
    console.error("Failed to add listing URL", error);
    listingError.value = "Failed to add listing URL.";
  } finally {
    savingDetail.value = false;
  }
}

async function updateListingUrl(listingId) {
  if (!selectedRoom.value?.id) return;
  if (!listingDraft.value.url.trim()) {
    listingError.value = "Please enter a listing URL.";
    return;
  }

  savingDetail.value = true;
  listingError.value = "";

  try {
    await api.patch(
      `/api/rooms/${selectedRoom.value.id}/listing-urls/${listingId}`,
      listingDraft.value
    );
    resetDetailForms();
    await refreshSelectedRoom();
  } catch (error) {
    console.error("Failed to update listing URL", error);
    listingError.value = "Failed to update listing URL.";
  } finally {
    savingDetail.value = false;
  }
}

async function setPrimaryListing(listingId) {
  if (!selectedRoom.value?.id) return;

  savingDetail.value = true;
  detailError.value = "";

  try {
    await api.post(`/api/rooms/${selectedRoom.value.id}/listing-urls/${listingId}/set-primary`);
    await refreshSelectedRoom();
  } catch (error) {
    console.error("Failed to set primary listing", error);
    detailError.value = "Failed to set primary listing.";
  } finally {
    savingDetail.value = false;
  }
}

async function deactivateListing(listingId) {
  if (!selectedRoom.value?.id) return;
  if (!window.confirm("Deactivate this listing URL?")) return;

  savingDetail.value = true;
  detailError.value = "";

  try {
    await api.delete(`/api/rooms/${selectedRoom.value.id}/listing-urls/${listingId}`);
    await refreshSelectedRoom();
  } catch (error) {
    console.error("Failed to deactivate listing URL", error);
    detailError.value = "Failed to deactivate listing URL.";
  } finally {
    savingDetail.value = false;
  }
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

      <div v-if="detailError" class="detail-alert">
        {{ detailError }}
      </div>

      <div class="room-detail-header">
        <div>
          <div class="detail-kicker">
            {{ selectedRoomContext.property.name }} / {{ selectedRoomContext.unit.name }}
          </div>

          <h1>
            {{ selectedRoom.name }}
          </h1>

          <p>
            {{ selectedRoom.status }}
          </p>
        </div>

        <div class="airbnb-actions">
          <a
            class="icon-button"
            :class="{ disabled: !airbnbLinks(selectedRoom).preview }"
            :href="airbnbLinks(selectedRoom).preview || undefined"
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
            :class="{ disabled: !airbnbLinks(selectedRoom).editListing }"
            :href="airbnbLinks(selectedRoom).editListing || undefined"
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
            :class="{ disabled: !airbnbLinks(selectedRoom).editCalendar }"
            :href="airbnbLinks(selectedRoom).editCalendar || undefined"
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
              <dd>{{ selectedRoom.name }}</dd>
            </div>

            <div>
              <dt>Listing Name</dt>
              <dd>{{ selectedRoom.listingName || "Not set" }}</dd>
            </div>

            <div>
              <dt>AppFolio Name</dt>
              <dd>{{ selectedRoom.appfolioName || "Not set" }}</dd>
            </div>

            <div>
              <dt>Cleaning</dt>
              <dd>{{ selectedRoom.cleaningStatus || "Not set" }}</dd>
            </div>

            <div>
              <dt>Leasing</dt>
              <dd>{{ selectedRoom.leasingStatus || "Not set" }}</dd>
            </div>
          </dl>
        </section>

        <section class="detail-section">
          <div class="section-title-row">
            <h2>Listings</h2>
            <button
              class="small-button"
              type="button"
              @click="addingListing = !addingListing"
            >
              {{ addingListing ? "Cancel" : "Add" }}
            </button>
          </div>

          <form
            v-if="addingListing"
            class="listing-form"
            @submit.prevent="addListingUrl"
          >
            <input v-model="newListing.url" placeholder="Listing / ICS URL" />
            <select v-model="newListing.channel">
              <option value="">Auto Detect</option>
              <option
                v-for="channel in channelOptions"
                :key="channel"
                :value="channel"
              >
                {{ channel }}
              </option>
            </select>
            <textarea v-model="newListing.notes" rows="2" placeholder="Notes" />
            <div v-if="listingError" class="field-error">
              {{ listingError }}
            </div>
            <button class="small-button primary" type="submit" :disabled="savingDetail">
              Save
            </button>
          </form>

          <div
            v-if="activeListings.length"
            class="listing-list"
          >
            <div
              v-for="listing in activeListings"
              :key="listing.id"
              class="listing-row"
            >
              <form
                v-if="editingListingId === listing.id"
                class="listing-edit-form"
                @submit.prevent="updateListingUrl(listing.id)"
              >
                <input v-model="listingDraft.url" placeholder="Listing / ICS URL" />
                <select v-model="listingDraft.channel">
                  <option
                    v-for="channel in channelOptions"
                    :key="channel"
                    :value="channel"
                  >
                    {{ channel }}
                  </option>
                </select>
                <textarea v-model="listingDraft.notes" rows="2" placeholder="Notes" />
                <div v-if="listingError" class="field-error">
                  {{ listingError }}
                </div>
                <div class="listing-actions">
                  <button class="small-button primary" type="submit" :disabled="savingDetail">
                    Save
                  </button>
                  <button class="small-button" type="button" @click="resetDetailForms">
                    Cancel
                  </button>
                </div>
              </form>

              <template v-else>
                <div>
                  <div class="listing-channel">
                    {{ listing.channel }}
                    <span v-if="listing.isPrimary" class="primary-tag">Primary</span>
                  </div>

                  <div class="listing-url">
                    {{ listing.url }}
                  </div>

                  <div v-if="listing.notes" class="listing-notes">
                    {{ listing.notes }}
                  </div>
                </div>

                <div class="listing-side">
                  <div class="listing-id">
                    {{ listing.listingId || extractAirbnbListingId(listing.url) || "No ID" }}
                  </div>
                  <div class="listing-actions">
                    <button class="small-button" type="button" @click="startEditListing(listing)">
                      Edit
                    </button>
                    <button
                      v-if="!listing.isPrimary"
                      class="small-button"
                      type="button"
                      :disabled="savingDetail"
                      @click="setPrimaryListing(listing.id)"
                    >
                      Primary
                    </button>
                    <button
                      class="small-button danger"
                      type="button"
                      :disabled="savingDetail"
                      @click="deactivateListing(listing.id)"
                    >
                      Deactivate
                    </button>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <div v-else class="empty-state">
            No listing URLs
          </div>
        </section>

        <section class="detail-section detail-note">
          <div class="section-title-row">
            <h2>Admin Notes</h2>
            <button
              class="small-button"
              type="button"
              @click="editingAdminNotes = !editingAdminNotes"
            >
              {{ editingAdminNotes ? "Cancel" : "Edit" }}
            </button>
          </div>

          <div v-if="!editingAdminNotes">
            <p>{{ selectedRoom.adminNotes || "No admin notes" }}</p>
          </div>

          <div v-else class="admin-note-editor">
            <textarea v-model="adminNotesInput" rows="4" placeholder="Internal admin notes" />
            <button
              class="small-button primary"
              type="button"
              :disabled="savingDetail"
              @click="saveAdminNotes"
            >
              Save Notes
            </button>
          </div>
        </section>

        <section class="detail-section detail-note">
          <h2>Note</h2>

          <p>
            {{ selectedRoom.note || "No note" }}
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

.detail-alert {
  margin-bottom: 14px;
  border-radius: 6px;
  background: #fff7ed;
  color: #9a3412;
  padding: 10px 12px;
  font-size: 13px;
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

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.section-title-row h2 {
  margin: 0;
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
  margin: 0;
}

.listing-list {
  display: grid;
  gap: 10px;
}

.listing-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
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

.primary-tag {
  display: inline-block;
  margin-left: 6px;
  border-radius: 999px;
  background: #ecfdf3;
  color: #027a48;
  padding: 2px 7px;
  font-size: 11px;
}

.listing-url,
.listing-notes {
  color: #6b7280;
  font-size: 12px;
  overflow-wrap: anywhere;
  margin-top: 2px;
}

.listing-side {
  display: grid;
  gap: 8px;
  justify-items: end;
}

.listing-id {
  color: #111827;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.listing-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.listing-form,
.listing-edit-form,
.admin-note-editor {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
}

.listing-form input,
.listing-form select,
.listing-form textarea,
.listing-edit-form input,
.listing-edit-form select,
.listing-edit-form textarea,
.admin-note-editor textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 8px 10px;
  font: inherit;
}

.small-button {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #ffffff;
  color: #111827;
  padding: 6px 9px;
  cursor: pointer;
  font-weight: 700;
}

.small-button.primary {
  border-color: #111827;
  background: #111827;
  color: #ffffff;
}

.small-button.danger {
  border-color: #fca5a5;
  color: #b42318;
}

.small-button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.field-error {
  color: #b42318;
  font-size: 12px;
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

  .listing-row {
    grid-template-columns: 1fr;
  }

  .listing-side {
    justify-items: start;
  }
}
</style>
