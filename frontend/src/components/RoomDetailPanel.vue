<script setup>
import { computed, ref } from "vue";
import api from "../api";

const props = defineProps({
  property: { type: Object, required: true },
  unit: { type: Object, required: true },
  initialRoom: { type: Object, required: true },
});

const emit = defineEmits(["close"]);

const room = ref({ ...props.initialRoom });
const loadingProfile = ref(false);
const detailError = ref("");
const savingDetail = ref(false);

const editingAdminNotes = ref(false);
const adminNotesInput = ref(props.initialRoom.adminNotes || "");

const addingListing = ref(false);
const newListing = ref({ url: "", channel: "", notes: "" });
const editingListingId = ref("");
const listingDraft = ref({ url: "", channel: "", notes: "" });
const listingError = ref("");

const channelOptions = ["Airbnb", "Booking.com", "VRBO", "Unknown"];

const activeListings = computed(() =>
  (room.value?.listingUrls || []).filter(
    (listing) => String(listing.status || "active").toLowerCase() === "active"
  )
);

function resetDetailForms() {
  addingListing.value = false;
  newListing.value = { url: "", channel: "", notes: "" };
  editingListingId.value = "";
  listingDraft.value = { url: "", channel: "", notes: "" };
  listingError.value = "";
  editingAdminNotes.value = false;
}

function extractAirbnbListingId(url) {
  const match = String(url || "").match(/\/calendar\/ical\/(\d+)\.ics/i);
  return match ? match[1] : "";
}

function numericId(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function airbnbListing(r) {
  const listings = r?.listingUrls || [];
  return (
    listings.find((u) => u.isPrimary && u.status === "active" && u.channel === "Airbnb") ||
    listings.find((u) => u.status === "active" && u.channel === "Airbnb") ||
    null
  );
}

function airbnbListingId(r) {
  const listing = airbnbListing(r);
  if (!listing) return null;
  return numericId(listing.listingId) || extractAirbnbListingId(listing.url) || null;
}

function airbnbLinks(r) {
  const listingId = airbnbListingId(r);
  if (!listingId) return {};
  return {
    preview: `https://www.airbnb.com/rooms/${listingId}`,
    editListing: `https://www.airbnb.com/hosting/listings/${listingId}`,
    editCalendar: `https://www.airbnb.com/multicalendar/${listingId}`,
  };
}

function startEditListing(listing) {
  editingListingId.value = listing.id;
  listingDraft.value = { url: listing.url, channel: listing.channel, notes: listing.notes || "" };
  listingError.value = "";
}

async function refreshSelectedRoom() {
  if (!room.value?.id) return;
  loadingProfile.value = true;
  try {
    const res = await api.get(`/api/rooms/${room.value.id}/profile`);
    const profile = res.data;
    room.value = { ...room.value, ...profile };
    adminNotesInput.value = profile.adminNotes || "";
  } catch (error) {
    console.error("Failed to refresh room profile", error);
    detailError.value = "Room details loaded from dashboard data; management actions may need backend API.";
  } finally {
    loadingProfile.value = false;
  }
}

async function saveAdminNotes() {
  savingDetail.value = true;
  detailError.value = "";
  try {
    await api.patch(`/api/rooms/${room.value.id}/admin-notes`, {
      adminNotes: adminNotesInput.value,
    });
    editingAdminNotes.value = false;
    await refreshSelectedRoom();
  } catch {
    detailError.value = "Failed to save admin notes.";
  } finally {
    savingDetail.value = false;
  }
}

async function addListingUrl() {
  savingDetail.value = true;
  listingError.value = "";
  try {
    await api.post(`/api/rooms/${room.value.id}/listing-urls`, newListing.value);
    addingListing.value = false;
    newListing.value = { url: "", channel: "", notes: "" };
    await refreshSelectedRoom();
  } catch (error) {
    listingError.value = error.response?.data?.message || "Failed to add listing.";
  } finally {
    savingDetail.value = false;
  }
}

async function updateListingUrl(listingId) {
  savingDetail.value = true;
  listingError.value = "";
  try {
    await api.patch(`/api/rooms/${room.value.id}/listing-urls/${listingId}`, listingDraft.value);
    resetDetailForms();
    await refreshSelectedRoom();
  } catch (error) {
    listingError.value = error.response?.data?.message || "Failed to update listing.";
  } finally {
    savingDetail.value = false;
  }
}

async function setPrimaryListing(listingId) {
  savingDetail.value = true;
  try {
    await api.post(`/api/rooms/${room.value.id}/listing-urls/${listingId}/set-primary`);
    await refreshSelectedRoom();
  } catch {
    detailError.value = "Failed to set primary listing.";
  } finally {
    savingDetail.value = false;
  }
}

async function deactivateListing(listingId) {
  savingDetail.value = true;
  detailError.value = "";
  try {
    await api.delete(`/api/rooms/${room.value.id}/listing-urls/${listingId}`);
    resetDetailForms();
    await refreshSelectedRoom();
  } catch {
    detailError.value = "Failed to deactivate listing.";
  } finally {
    savingDetail.value = false;
  }
}

refreshSelectedRoom();
</script>

<template>
  <div class="room-detail-page">
    <div class="detail-topbar">
      <button class="back-button" type="button" @click="emit('close')">
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
          {{ props.property.name }} / {{ props.unit.name }}
        </div>

        <h1>{{ room.name }}</h1>

        <p>{{ room.status }}</p>

        <p v-if="room.upcomingReservations?.[0]?.guestId" class="header-guest-id">
          Guest ID: {{ room.upcomingReservations[0].guestId }}
        </p>
      </div>

      <div class="airbnb-actions">
        <a
          class="icon-button"
          :class="{ disabled: !airbnbLinks(room).preview }"
          :href="airbnbLinks(room).preview || undefined"
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
          :class="{ disabled: !airbnbLinks(room).editListing }"
          :href="airbnbLinks(room).editListing || undefined"
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
          :class="{ disabled: !airbnbLinks(room).editCalendar }"
          :href="airbnbLinks(room).editCalendar || undefined"
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
            <dd>{{ props.property.name }}</dd>
          </div>

          <div>
            <dt>Unit</dt>
            <dd>{{ props.unit.name }}</dd>
          </div>

          <div>
            <dt>Room</dt>
            <dd>{{ room.name }}</dd>
          </div>

          <div>
            <dt>Listing Name</dt>
            <dd>{{ room.listingName || "Not set" }}</dd>
          </div>

          <div>
            <dt>AppFolio Name</dt>
            <dd>{{ room.appfolioName || "Not set" }}</dd>
          </div>

          <div>
            <dt>Cleaning</dt>
            <dd>{{ room.cleaningStatus || "Not set" }}</dd>
          </div>

          <div>
            <dt>Leasing</dt>
            <dd>{{ room.leasingStatus || "Not set" }}</dd>
          </div>
        </dl>
      </section>

      <section class="detail-section">
        <div class="section-title-row">
          <h2>Listings</h2>
          <button class="small-button" type="button" @click="addingListing = !addingListing">
            {{ addingListing ? "Cancel" : "Add" }}
          </button>
        </div>

        <form v-if="addingListing" class="listing-form" @submit.prevent="addListingUrl">
          <input v-model="newListing.url" placeholder="Listing / ICS URL" />
          <select v-model="newListing.channel">
            <option value="">Auto Detect</option>
            <option v-for="channel in channelOptions" :key="channel" :value="channel">
              {{ channel }}
            </option>
          </select>
          <textarea v-model="newListing.notes" rows="2" placeholder="Notes" />
          <div v-if="listingError" class="field-error">{{ listingError }}</div>
          <button class="small-button primary" type="submit" :disabled="savingDetail">Save</button>
        </form>

        <div v-if="activeListings.length" class="listing-list">
          <div v-for="listing in activeListings" :key="listing.id" class="listing-row">
            <form
              v-if="editingListingId === listing.id"
              class="listing-edit-form"
              @submit.prevent="updateListingUrl(listing.id)"
            >
              <input v-model="listingDraft.url" placeholder="Listing / ICS URL" />
              <select v-model="listingDraft.channel">
                <option v-for="channel in channelOptions" :key="channel" :value="channel">
                  {{ channel }}
                </option>
              </select>
              <textarea v-model="listingDraft.notes" rows="2" placeholder="Notes" />
              <div v-if="listingError" class="field-error">{{ listingError }}</div>
              <div class="listing-actions">
                <button class="small-button primary" type="submit" :disabled="savingDetail">Save</button>
                <button class="small-button" type="button" @click="resetDetailForms">Cancel</button>
              </div>
            </form>

            <template v-else>
              <div>
                <div class="listing-channel">
                  {{ listing.channel }}
                  <span v-if="listing.isPrimary" class="primary-tag">Primary</span>
                </div>
                <div class="listing-url">{{ listing.url }}</div>
                <div v-if="listing.notes" class="listing-notes">{{ listing.notes }}</div>
              </div>

              <div class="listing-side">
                <div class="listing-id">
                  {{ listing.listingId || extractAirbnbListingId(listing.url) || "No ID" }}
                </div>
                <div class="listing-actions">
                  <button class="small-button" type="button" @click="startEditListing(listing)">Edit</button>
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

        <div v-else class="empty-state">No listing URLs</div>
      </section>

      <section class="detail-section detail-note">
        <div class="section-title-row">
          <h2>Admin Notes</h2>
          <button class="small-button" type="button" @click="editingAdminNotes = !editingAdminNotes">
            {{ editingAdminNotes ? "Cancel" : "Edit" }}
          </button>
        </div>

        <div v-if="!editingAdminNotes">
          <p>{{ room.adminNotes || "No admin notes" }}</p>
        </div>

        <div v-else class="admin-note-editor">
          <textarea v-model="adminNotesInput" rows="4" placeholder="Internal admin notes" />
          <button class="small-button primary" type="button" :disabled="savingDetail" @click="saveAdminNotes">
            Save Notes
          </button>
        </div>
      </section>

      <section class="detail-section detail-note">
        <h2>Note</h2>
        <p>{{ room.note || "No note" }}</p>
      </section>

      <section v-if="room.upcomingReservations?.length" class="detail-section detail-reservation">
        <h2>Reservations</h2>

        <div v-for="(res, i) in room.upcomingReservations" :key="i" class="reservation-card">
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
</template>

<style scoped>
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

.header-guest-id {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--ink-3);
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

.section-title-row h2 { margin: 0; }

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

.reservation-card {
  padding: 10px 0;
  border-bottom: 1px solid var(--linen);
}

.reservation-card:last-child { border-bottom: none; }

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

.reservation-badge.current { background: #d1fae5; color: #065f46; }
.reservation-badge.upcoming { background: #e0e7ff; color: #3730a3; }

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

.reservation-link:hover { text-decoration: underline; }

.listing-list { display: grid; gap: 10px; }

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

.listing-channel { color: var(--ink); font-size: 13px; font-weight: 700; }

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

.listing-side { display: grid; gap: 8px; justify-items: end; }

.listing-id { color: var(--ink); font-size: 12px; font-weight: 700; white-space: nowrap; }

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
.small-button.primary { border-color: var(--ink); background: var(--ink); color: var(--parchment); }
.small-button.primary:hover { opacity: 0.85; }
.small-button.danger { border-color: #e8b4ae; color: var(--s-error-ink); }
.small-button.danger:hover { background: var(--s-error-bg); }
.small-button:disabled { opacity: 0.45; cursor: wait; }

.field-error { color: var(--s-error-ink); font-size: 12px; }
.empty-state { color: var(--ink-3); font-size: 14px; }

@media (max-width: 760px) {
  .room-detail-header { flex-direction: column; }
}
</style>
