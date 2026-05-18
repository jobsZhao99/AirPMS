<script setup>
import { computed, onMounted, ref } from "vue";
import api from "../api";

const properties = ref([]);
const loading = ref(false);
const selectedRoomContext = ref(null);
const loadingProfile = ref(false);
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

const dashboardMode = ref("leasing");
const dashboardModes = [
  { key: "leasing", label: "Leasing Occupancy" },
  { key: "roomStatus", label: "Room Status" },
];

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

  loadingProfile.value = true;
  try {
    const res = await api.get(`/api/rooms/${selectedRoom.value.id}/profile`);
    const profile = res.data;

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
  } finally {
    loadingProfile.value = false;
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
      <div class="detail-topbar">
        <button
          class="back-button"
          type="button"
          @click="closeRoomDetails"
        >
          Back
        </button>
        <span v-if="loadingProfile" class="profile-loading">Loading…</span>
      </div>

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

          <p v-if="selectedRoom.upcomingReservations?.[0]?.guestId" class="header-guest-id">
            Guest ID: {{ selectedRoom.upcomingReservations[0].guestId }}
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

        <section v-if="selectedRoom.upcomingReservations?.length" class="detail-section detail-reservation">
          <h2>Reservations</h2>

          <div
            v-for="(res, i) in selectedRoom.upcomingReservations"
            :key="i"
            class="reservation-card"
          >
            <div class="reservation-dates">
              <span v-if="res.isCurrent" class="reservation-badge current">Current</span>
              <span v-else class="reservation-badge upcoming">Upcoming</span>
              {{ new Date(res.checkIn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }}
              –
              {{ new Date(res.checkOut).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }}
            </div>
            <div class="reservation-meta">
              <span v-if="res.guestId">Guest ID: {{ res.guestId }}</span>
              <span v-if="res.reservationCode">
                Code:
                <a
                  v-if="res.reservationLink"
                  :href="res.reservationLink"
                  target="_blank"
                  rel="noreferrer"
                  class="reservation-link"
                >{{ res.reservationCode }}</a>
                <span v-else>{{ res.reservationCode }}</span>
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>

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
          <button
            class="secondary-button"
            @click="loadDashboard"
            :disabled="loading"
          >
            Refresh
          </button>
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
                  rowIndex === 0 ? unitCellClass(unit) : '',
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
                <div class="room-name">
                  Whole Unit / No Rooms
                </div>

                <div
                  v-if="hasListingUrls(unit)"
                  class="room-status"
                >
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
                <span class="room-name">
                  {{ room.name }}
                </span>

                <span class="room-status">
                  {{ roomDisplayStatus(room) }}
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

.page-header h1 {
  font-size: 26px;
  letter-spacing: -0.4px;
}

.page-header p {
  margin-top: 4px;
  color: var(--ink-3);
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
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

.secondary-button {
  background: var(--ink-2) !important;
}

.loading {
  margin-bottom: 16px;
  color: var(--ink-3);
  font-size: 14px;
}

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

.inventory-table {
  width: 100%;
  overflow-x: auto;
}

.inventory-row {
  display: flex;
  min-height: 60px;
  border-bottom: 1px solid var(--linen);
}

.inventory-row:last-child {
  border-bottom: none;
}

.unit-cell {
  width: 190px;
  min-width: 190px;
  padding: 10px 14px;
  border-right: 1px solid var(--linen);
  background: var(--surface-2);
  display: flex;
  align-items: center;
}

.unit-cell.muted {
  color: transparent;
  background: var(--parchment);
}

.unit-name {
  font-weight: 700;
  font-size: 13px;
  color: var(--ink);
}

.unit-status {
  font-size: 11px;
  color: var(--ink-2);
  margin-top: 3px;
  font-weight: 700;
}

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
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--linen);
  transition: background 0.15s;
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
  background: var(--surface-2);
}

.room-button:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: -2px;
}

.room-name {
  font-weight: 700;
  font-size: 13px;
  color: var(--ink);
}

.room-status {
  font-size: 11px;
  color: var(--ink-2);
  margin-top: 3px;
}

.empty-room-cell {
  color: var(--ink-3);
  font-style: italic;
  width: 260px;
  min-width: 260px;
}

.room-cell.airbnb-rented,
.unit-cell.airbnb-rented {
  background: var(--s-airbnb-bg);
}
.room-cell.airbnb-rented::before { background: var(--s-airbnb-ink); }
.room-cell.airbnb-rented .room-name,
.room-cell.airbnb-rented .room-status { color: var(--s-airbnb-ink); }
.unit-cell.airbnb-rented .unit-name,
.unit-cell.airbnb-rented .unit-status { color: var(--s-airbnb-ink); }

.room-cell.booking-rented,
.unit-cell.booking-rented,
.room-cell.rented,
.unit-cell.rented {
  background: var(--s-booking-bg);
}
.room-cell.booking-rented::before,
.room-cell.rented::before { background: var(--s-booking-ink); }
.room-cell.booking-rented .room-name,
.room-cell.booking-rented .room-status,
.room-cell.rented .room-name,
.room-cell.rented .room-status { color: var(--s-booking-ink); }
.unit-cell.booking-rented .unit-name,
.unit-cell.booking-rented .unit-status { color: var(--s-booking-ink); }

.room-cell.long-term,
.unit-cell.long-term {
  background: var(--s-longterm-bg);
}
.room-cell.long-term::before { background: var(--s-longterm-ink); }
.room-cell.long-term .room-name,
.room-cell.long-term .room-status { color: var(--s-longterm-ink); }
.unit-cell.long-term .unit-name,
.unit-cell.long-term .unit-status { color: var(--s-longterm-ink); }

.room-cell.vacant,
.unit-cell.vacant,
.room-cell.available,
.unit-cell.available {
  background: var(--surface);
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
  background: var(--s-error-bg);
}
.room-cell.error::before,
.room-cell.maintenance::before,
.room-cell.offline::before,
.room-cell.inactive::before,
.room-cell.no-ics::before,
.room-cell.occupied::before { background: var(--s-error-ink); }
.room-cell.error .room-name,
.room-cell.maintenance .room-name,
.room-cell.error .room-status { color: var(--s-error-ink); }

/* Header right side: toggle + refresh */
.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

/* Single mode toggle button */
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
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: stroke 0.15s;
}

.mode-toggle-button:hover {
  background: var(--surface-2);
  border-color: var(--ink);
}

.mode-toggle-button:hover svg {
  stroke: var(--ink);
}

/* Cleaning status cells */
.room-cell.cleaned,
.unit-cell.cleaned {
  background: var(--s-cleaned-bg);
}
.room-cell.cleaned::before { background: var(--s-cleaned-ink); }
.room-cell.cleaned .room-name,
.room-cell.cleaned .room-status,
.unit-cell.cleaned .unit-name,
.unit-cell.cleaned .unit-status { color: var(--s-cleaned-ink); }

.room-cell.dirty,
.unit-cell.dirty {
  background: var(--s-error-bg);
}
.room-cell.dirty::before { background: var(--s-error-ink); }
.room-cell.dirty .room-name,
.room-cell.dirty .room-status,
.unit-cell.dirty .unit-name,
.unit-cell.dirty .unit-status { color: var(--s-error-ink); }

.room-cell.need-setup,
.unit-cell.need-setup {
  background: #fde8cc;
}
.room-cell.need-setup::before { background: #b56a00; }
.room-cell.need-setup .room-name,
.room-cell.need-setup .room-status,
.unit-cell.need-setup .unit-name,
.unit-cell.need-setup .unit-status { color: #b56a00; }

.room-cell.need-spiff,
.unit-cell.need-spiff {
  background: #fef3c7;
}
.room-cell.need-spiff::before { background: #92700a; }
.room-cell.need-spiff .room-name,
.room-cell.need-spiff .room-status,
.unit-cell.need-spiff .unit-name,
.unit-cell.need-spiff .unit-status { color: #92700a; }

.room-cell.under-pipeline,
.unit-cell.under-pipeline {
  background: #eaeff4;
}
.room-cell.under-pipeline::before { background: #6a8898; }
.room-cell.under-pipeline .room-name,
.room-cell.under-pipeline .room-status,
.unit-cell.under-pipeline .unit-name,
.unit-cell.under-pipeline .unit-status { color: #5a7a8a; }

.room-detail-page {
  text-align: left;
}

.detail-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.back-button {
  border: 1px solid var(--linen-2);
  background: var(--surface);
  color: var(--ink);
  border-radius: var(--r-sm);
  padding: 8px 14px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  transition: background 0.15s;
}

.back-button:hover { background: var(--surface-2); }

.profile-loading {
  font-size: 12px;
  color: var(--ink-3);
}

.detail-alert {
  margin-bottom: 14px;
  border-radius: var(--r-sm);
  background: var(--s-error-bg);
  color: var(--s-error-ink);
  padding: 10px 14px;
  font-size: 13px;
  border: 1px solid #e8b4ae;
}

.room-detail-header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--linen);
  margin-bottom: 20px;
}

.detail-kicker {
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.room-detail-header h1 {
  margin: 0;
  font-size: 30px;
  letter-spacing: -0.5px;
}

.room-detail-header p {
  margin-top: 8px;
  color: var(--ink-2);
  font-size: 14px;
}

.airbnb-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.icon-button {
  width: 38px;
  height: 38px;
  border-radius: var(--r-sm);
  border: 1px solid var(--linen);
  background: var(--surface);
  color: var(--ink-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  transition: border-color 0.15s, color 0.15s;
}

.icon-button:hover {
  border-color: var(--ink);
  color: var(--ink);
}

.icon-button.disabled {
  opacity: 0.3;
  pointer-events: none;
}

.icon-button svg {
  width: 17px;
  height: 17px;
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
  background: var(--surface);
  border: 1px solid var(--linen);
  border-radius: var(--r-md);
  padding: 18px;
  box-shadow: var(--shadow-xs);
}

.detail-section h2 {
  margin: 0 0 14px;
  font-size: 15px;
  letter-spacing: -0.1px;
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
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.detail-section dd {
  color: var(--ink);
  font-size: 14px;
  margin: 0;
  overflow-wrap: anywhere;
}

.detail-note {
  grid-column: 1 / -1;
}

.detail-note p {
  white-space: pre-wrap;
  color: var(--ink-2);
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
}

.detail-reservation {
  grid-column: 1 / -1;
}

.header-guest-id {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--ink-3);
}

.reservation-card {
  padding: 10px 0;
  border-bottom: 1px solid var(--linen);
}

.reservation-card:last-child {
  border-bottom: none;
}

.reservation-dates {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 4px;
}

.reservation-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.reservation-badge.current {
  background: #d1fae5;
  color: #065f46;
}

.reservation-badge.upcoming {
  background: #e0e7ff;
  color: #3730a3;
}

.reservation-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 13px;
  color: var(--ink-3);
}

.reservation-link {
  color: var(--s-booking-ink, #1a73e8);
  font-weight: 700;
  text-decoration: none;
}

.reservation-link:hover {
  text-decoration: underline;
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
  padding: 10px 12px;
  background: var(--surface-2);
  border: 1px solid var(--linen);
  border-radius: var(--r-sm);
}

.listing-channel {
  color: var(--ink);
  font-size: 13px;
  font-weight: 700;
}

.primary-tag {
  display: inline-block;
  margin-left: 6px;
  border-radius: 999px;
  background: var(--s-cleaned-bg);
  color: var(--s-cleaned-ink);
  padding: 2px 7px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.listing-url,
.listing-notes {
  color: var(--ink-3);
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
  color: var(--ink);
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
  border: 1px solid var(--linen);
  border-radius: var(--r-sm);
  padding: 8px 10px;
  background: var(--surface);
  font: inherit;
  transition: border-color 0.15s;
}

.listing-form input:focus,
.listing-form select:focus,
.listing-form textarea:focus,
.listing-edit-form input:focus,
.listing-edit-form select:focus,
.listing-edit-form textarea:focus,
.admin-note-editor textarea:focus {
  outline: none;
  border-color: var(--ink-2);
}

.small-button {
  border: 1px solid var(--linen);
  border-radius: var(--r-sm);
  background: var(--surface);
  color: var(--ink);
  padding: 6px 10px;
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  transition: background 0.15s, border-color 0.15s;
}

.small-button:hover { background: var(--surface-2); }

.small-button.primary {
  border-color: var(--ink);
  background: var(--ink);
  color: var(--parchment);
}

.small-button.primary:hover { opacity: 0.85; }

.small-button.danger {
  border-color: #e8b4ae;
  color: var(--s-error-ink);
}

.small-button.danger:hover { background: var(--s-error-bg); }

.small-button:disabled { opacity: 0.45; cursor: wait; }

.field-error {
  color: var(--s-error-ink);
  font-size: 12px;
}

.empty-state {
  color: var(--ink-3);
  font-size: 14px;
}

@media (max-width: 760px) {
  .room-detail-header { flex-direction: column; }
  .airbnb-actions { justify-content: flex-start; }
  .detail-grid { grid-template-columns: 1fr; }
  .detail-note { grid-column: auto; }
  .listing-row { grid-template-columns: 1fr; }
  .listing-side { justify-items: start; }
}
</style>
