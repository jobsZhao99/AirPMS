<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import api from "../api";

const route = useRoute();
const router = useRouter();

const profile = ref(null);
const loading = ref(false);
const error = ref("");
const saving = ref(false);

const editingNotes = ref(false);
const notesInput = ref("");

const addingUrl = ref(false);
const newUrl = ref({ url: "", channel: "", notes: "" });
const editingUrlId = ref("");
const editUrl = ref({ url: "", channel: "", notes: "" });
const urlError = ref("");

const channelOptions = ["Airbnb", "Booking.com", "VRBO", "Unknown"];

const activeUrls = computed(() =>
  (profile.value?.listingUrls || []).filter((listing) => listing.status === "active")
);

const inactiveUrlCount = computed(() =>
  (profile.value?.listingUrls || []).filter((listing) => listing.status !== "active").length
);

function roomTitle() {
  return profile.value?.name || "Room";
}

function listingSubtitle() {
  return [
    profile.value?.unit?.property?.name,
    profile.value?.unit?.name,
  ].filter(Boolean).join(" / ");
}

function statusValue(primary, fallback = "Unknown") {
  return primary || fallback;
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusClass(status) {
  const value = String(status || "").toLowerCase();

  if (value.includes("airbnb")) return "status-airbnb";
  if (value.includes("booking")) return "status-booking";
  if (value.includes("long")) return "status-longterm";
  if (value.includes("vacant")) return "status-vacant";
  if (value.includes("dirty") || value.includes("error")) return "status-warning";
  return "status-default";
}

function startEditUrl(listing) {
  editingUrlId.value = listing.id;
  editUrl.value = {
    url: listing.url || "",
    channel: listing.channel || "Unknown",
    notes: listing.notes || "",
  };
}

function resetUrlForms() {
  addingUrl.value = false;
  editingUrlId.value = "";
  newUrl.value = { url: "", channel: "", notes: "" };
  editUrl.value = { url: "", channel: "", notes: "" };
  urlError.value = "";
}

async function load() {
  loading.value = true;
  error.value = "";

  try {
    const res = await api.get(`/api/rooms/${route.params.id}/profile`);
    profile.value = res.data;
    notesInput.value = res.data.adminNotes || "";
  } catch (err) {
    console.error(err);
    error.value = "无法加载房间详情，请检查后端和数据库连接。";
  } finally {
    loading.value = false;
  }
}

async function saveNotes() {
  saving.value = true;
  error.value = "";

  try {
    await api.patch(`/api/rooms/${route.params.id}/admin-notes`, {
      adminNotes: notesInput.value,
    });
    profile.value.adminNotes = notesInput.value;
    editingNotes.value = false;
  } catch (err) {
    console.error(err);
    error.value = "Admin Notes 保存失败。";
  } finally {
    saving.value = false;
  }
}

async function addUrl() {
  urlError.value = "";
  if (!newUrl.value.url.trim()) {
    urlError.value = "请输入 listing URL。";
    return;
  }

  saving.value = true;

  try {
    // 后端会从 Airbnb ICS URL 提取 listingId，前端不再维护 externalListingId。
    await api.post(`/api/rooms/${route.params.id}/listing-urls`, newUrl.value);
    resetUrlForms();
    await load();
  } catch (err) {
    console.error(err);
    urlError.value = "添加 listing URL 失败。";
  } finally {
    saving.value = false;
  }
}

async function updateUrl(urlId) {
  urlError.value = "";
  if (!editUrl.value.url.trim()) {
    urlError.value = "请输入 listing URL。";
    return;
  }

  saving.value = true;

  try {
    await api.patch(`/api/rooms/${route.params.id}/listing-urls/${urlId}`, editUrl.value);
    resetUrlForms();
    await load();
  } catch (err) {
    console.error(err);
    urlError.value = "更新 listing URL 失败。";
  } finally {
    saving.value = false;
  }
}

async function setPrimary(urlId) {
  saving.value = true;

  try {
    await api.post(`/api/rooms/${route.params.id}/listing-urls/${urlId}/set-primary`);
    await load();
  } catch (err) {
    console.error(err);
    error.value = "设置 primary listing 失败。";
  } finally {
    saving.value = false;
  }
}

async function deactivateUrl(urlId) {
  if (!window.confirm("确认停用这个 listing URL？")) return;

  saving.value = true;

  try {
    await api.delete(`/api/rooms/${route.params.id}/listing-urls/${urlId}`);
    await load();
  } catch (err) {
    console.error(err);
    error.value = "停用 listing URL 失败。";
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <main class="room-page">
    <button class="back-button" type="button" @click="router.back()">
      Back
    </button>

    <div v-if="error" class="notice error">
      {{ error }}
    </div>

    <div v-if="loading" class="notice">
      Loading room details...
    </div>

    <template v-if="profile">
      <header class="room-header">
        <div>
          <p class="context-line">
            {{ listingSubtitle() }}
          </p>
          <h1>{{ roomTitle() }}</h1>
          <div class="status-row">
            <span class="status-pill" :class="statusClass(profile.status)">
              {{ statusValue(profile.status) }}
            </span>
            <span class="status-pill" :class="statusClass(profile.leasingStatus)">
              Leasing: {{ statusValue(profile.leasingStatus, "Vacant") }}
            </span>
            <span class="status-pill" :class="statusClass(profile.cleaningStatus)">
              Cleaning: {{ statusValue(profile.cleaningStatus, "UnderPipeline") }}
            </span>
          </div>
        </div>
      </header>

      <section class="detail-grid">
        <article class="panel">
          <h2>Room</h2>
          <dl class="info-list">
            <div>
              <dt>Property</dt>
              <dd>{{ profile.unit?.property?.name || "-" }}</dd>
            </div>
            <div>
              <dt>Unit</dt>
              <dd>{{ profile.unit?.name || "-" }}</dd>
            </div>
            <div>
              <dt>Room</dt>
              <dd>{{ profile.name || "-" }}</dd>
            </div>
            <div>
              <dt>Listing Name</dt>
              <dd>{{ profile.listingName || "-" }}</dd>
            </div>
            <div>
              <dt>AppFolio Name</dt>
              <dd>{{ profile.appfolioName || "-" }}</dd>
            </div>
            <div>
              <dt>Cleaning</dt>
              <dd>{{ statusValue(profile.cleaningStatus, "UnderPipeline") }}</dd>
            </div>
            <div>
              <dt>Leasing</dt>
              <dd>{{ statusValue(profile.leasingStatus, "Vacant") }}</dd>
            </div>
          </dl>
        </article>

        <article class="panel">
          <div class="panel-title-row">
            <h2>Listings</h2>
            <button class="secondary-button" type="button" @click="addingUrl = !addingUrl">
              {{ addingUrl ? "Cancel" : "Add Listing" }}
            </button>
          </div>

          <form v-if="addingUrl" class="listing-form" @submit.prevent="addUrl">
            <input v-model="newUrl.url" placeholder="Listing / ICS URL" />
            <select v-model="newUrl.channel">
              <option value="">Auto Detect</option>
              <option v-for="channel in channelOptions" :key="channel" :value="channel">
                {{ channel }}
              </option>
            </select>
            <textarea v-model="newUrl.notes" rows="2" placeholder="Notes" />
            <p v-if="urlError" class="field-error">{{ urlError }}</p>
            <button class="primary-button" type="submit" :disabled="saving">
              Save Listing
            </button>
          </form>

          <p v-if="!activeUrls.length" class="empty-copy">
            No active listing URLs yet.
          </p>

          <div v-for="listing in activeUrls" :key="listing.id" class="listing-card">
            <template v-if="editingUrlId === listing.id">
              <form class="listing-form" @submit.prevent="updateUrl(listing.id)">
                <input v-model="editUrl.url" placeholder="Listing / ICS URL" />
                <select v-model="editUrl.channel">
                  <option v-for="channel in channelOptions" :key="channel" :value="channel">
                    {{ channel }}
                  </option>
                </select>
                <textarea v-model="editUrl.notes" rows="2" placeholder="Notes" />
                <p v-if="urlError" class="field-error">{{ urlError }}</p>
                <div class="button-row">
                  <button class="primary-button" type="submit" :disabled="saving">
                    Save
                  </button>
                  <button class="secondary-button" type="button" @click="resetUrlForms">
                    Cancel
                  </button>
                </div>
              </form>
            </template>

            <template v-else>
              <div class="listing-main">
                <div class="listing-heading">
                  <strong>{{ listing.channel || "Unknown" }}</strong>
                  <span v-if="listing.isPrimary" class="small-tag">Primary</span>
                </div>
                <a class="listing-url" :href="listing.url" target="_blank" rel="noreferrer">
                  {{ listing.url }}
                </a>
                <p v-if="listing.listingId" class="muted-line">
                  Channel listing ID: {{ listing.listingId }}
                </p>
                <p v-if="listing.notes" class="muted-line">
                  {{ listing.notes }}
                </p>
                <div v-if="listing.links" class="link-row">
                  <a :href="listing.links.listingPage" target="_blank" rel="noreferrer">
                    Airbnb Listing
                  </a>
                  <a :href="listing.links.hostManagePage" target="_blank" rel="noreferrer">
                    Airbnb Manage
                  </a>
                </div>
              </div>

              <div class="listing-actions">
                <button class="secondary-button" type="button" @click="startEditUrl(listing)">
                  Edit
                </button>
                <button
                  v-if="!listing.isPrimary"
                  class="secondary-button"
                  type="button"
                  :disabled="saving"
                  @click="setPrimary(listing.id)"
                >
                  Set Primary
                </button>
                <button
                  class="danger-button"
                  type="button"
                  :disabled="saving"
                  @click="deactivateUrl(listing.id)"
                >
                  Deactivate
                </button>
              </div>
            </template>
          </div>

          <p v-if="inactiveUrlCount" class="empty-copy">
            {{ inactiveUrlCount }} inactive listing URL(s) hidden from active use.
          </p>
        </article>
      </section>

      <section v-if="profile.currentReservation" class="panel">
        <h2>Current / Upcoming Reservation</h2>
        <p class="reservation-line">
          {{ formatDate(profile.currentReservation.checkIn) }}
          -
          {{ formatDate(profile.currentReservation.checkOut) }}
        </p>
        <a
          v-if="profile.currentReservation.reservationLink"
          :href="profile.currentReservation.reservationLink"
          target="_blank"
          rel="noreferrer"
        >
          Open reservation
        </a>
      </section>

      <section class="panel">
        <div class="panel-title-row">
          <h2>Admin Notes</h2>
          <button class="secondary-button" type="button" @click="editingNotes = !editingNotes">
            {{ editingNotes ? "Cancel" : "Edit" }}
          </button>
        </div>

        <p class="note-hint">
          Manual notes for your team. These do not overwrite the synced system note.
        </p>

        <div v-if="!editingNotes" class="note-body">
          {{ profile.adminNotes || "No admin notes yet." }}
        </div>

        <div v-else class="notes-editor">
          <textarea v-model="notesInput" rows="5" placeholder="Internal admin notes" />
          <button class="primary-button" type="button" :disabled="saving" @click="saveNotes">
            Save Notes
          </button>
        </div>
      </section>

      <section class="panel">
        <h2>Note</h2>
        <pre class="system-note">{{ profile.note || "No system note." }}</pre>
      </section>
    </template>
  </main>
</template>

<style scoped>
.room-page {
  min-height: 100vh;
  padding: 28px;
  background: #f7f8fa;
  color: #111827;
  font-family: Arial, sans-serif;
}

.back-button,
.secondary-button,
.danger-button,
.primary-button {
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
}

.back-button {
  border: 1px solid #d1d5db;
  background: #ffffff;
  padding: 9px 16px;
  color: #111827;
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  padding: 28px 0 34px;
}

.context-line {
  margin: 0 0 10px;
  color: #6b7280;
  font-weight: 700;
}

.room-header h1 {
  margin: 0;
  font-size: 34px;
  line-height: 1.1;
}

.status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.status-pill,
.small-tag {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 800;
}

.status-airbnb,
.status-booking {
  background: #e0f2fe;
  color: #075985;
}

.status-longterm,
.status-default {
  background: #f3f4f6;
  color: #374151;
}

.status-vacant {
  background: #ecfdf3;
  color: #027a48;
}

.status-warning {
  background: #fff7ed;
  color: #c2410c;
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(280px, 0.72fr) minmax(420px, 1fr);
  gap: 20px;
}

.panel {
  margin-bottom: 20px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  padding: 22px;
}

.panel h2 {
  margin: 0 0 18px;
  font-size: 20px;
}

.panel-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}

.panel-title-row h2 {
  margin: 0;
}

.info-list {
  margin: 0;
}

.info-list div {
  margin-bottom: 22px;
}

.info-list dt {
  margin-bottom: 8px;
  color: #6b7280;
  font-size: 14px;
  font-weight: 800;
}

.info-list dd {
  margin: 0;
  font-size: 18px;
}

.listing-form,
.notes-editor {
  display: grid;
  gap: 10px;
}

.listing-form {
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  margin-bottom: 14px;
}

.listing-form input,
.listing-form select,
.listing-form textarea,
.notes-editor textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 10px 12px;
  color: #111827;
  font: inherit;
}

.listing-card {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 12px;
  background: #fbfdff;
}

.listing-main {
  min-width: 0;
}

.listing-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.small-tag {
  background: #ecfdf3;
  color: #027a48;
}

.listing-url {
  display: block;
  color: #4b5563;
  word-break: break-all;
  text-decoration: none;
}

.listing-url:hover,
.link-row a:hover {
  text-decoration: underline;
}

.muted-line,
.empty-copy,
.note-hint {
  margin: 8px 0 0;
  color: #6b7280;
  line-height: 1.5;
}

.link-row,
.button-row,
.listing-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.link-row {
  margin-top: 10px;
}

.link-row a {
  color: #2563eb;
  text-decoration: none;
  font-weight: 700;
}

.listing-actions {
  justify-content: flex-end;
  align-content: flex-start;
  min-width: 120px;
}

.secondary-button,
.danger-button {
  border: 1px solid #d1d5db;
  background: #ffffff;
  padding: 8px 11px;
  color: #374151;
}

.danger-button {
  border-color: #fca5a5;
  color: #b42318;
}

.primary-button {
  width: fit-content;
  border: 0;
  background: #111827;
  color: #ffffff;
  padding: 9px 14px;
}

button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.field-error,
.notice.error {
  color: #b42318;
}

.notice {
  margin: 18px 0;
  border-radius: 8px;
  background: #eaf3f5;
  padding: 14px 16px;
}

.note-body,
.system-note {
  white-space: pre-wrap;
  line-height: 1.6;
  color: #374151;
}

.system-note {
  margin: 0;
  font-family: inherit;
}

.reservation-line {
  margin: 0 0 8px;
  font-weight: 800;
}

@media (max-width: 900px) {
  .room-page {
    padding: 18px;
  }

  .detail-grid,
  .listing-card {
    display: block;
  }

  .listing-actions {
    justify-content: flex-start;
    margin-top: 12px;
  }
}
</style>
