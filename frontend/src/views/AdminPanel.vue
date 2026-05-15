<script setup>
import { ref } from "vue";
import api from "../api";

const syncingIcs = ref(false);
const syncingLongterm = ref(false);
const downloading = ref(false);
const message = ref("");
const messageType = ref("default");

function askForPassword() {
  return window.prompt("Enter admin password:");
}

function setMessage(text, type = "default") {
  message.value = text;
  messageType.value = type;
}

function getDownloadFilename(headers) {
  const disposition = headers["content-disposition"];
  const match = disposition?.match(/filename="?([^"]+)"?/i);

  return match?.[1] || `airpms-database-${new Date().toISOString().slice(0, 10)}.json`;
}

async function syncIcs() {
  const password = askForPassword();

  if (!password) return;

  syncingIcs.value = true;
  setMessage("");

  try {
    const res = await api.post("/admin/sync-ics", {
      password,
    });

    console.log("ICS sync result:", res.data);
    setMessage("ICS sync completed.", "success");
  } catch (error) {
    console.error("Failed to sync ICS", error);
    setMessage(
      error.response?.status === 401 ? "Invalid password." : "ICS sync failed.",
      "error"
    );
  } finally {
    syncingIcs.value = false;
  }
}

async function syncLongterm() {
  const password = askForPassword();

  if (!password) return;

  syncingLongterm.value = true;
  setMessage("");

  try {
    const res = await api.post("/admin/sync-longterm", {
      password,
    });

    console.log("Long Term sync result:", res.data);
    setMessage("Long Term sync completed.", "success");
  } catch (error) {
    console.error("Failed to sync Long Term", error);
    setMessage(
      error.response?.status === 401
        ? "Invalid password."
        : "Long Term sync failed.",
      "error"
    );
  } finally {
    syncingLongterm.value = false;
  }
}

async function downloadDatabase() {
  const password = askForPassword();

  if (!password) return;

  downloading.value = true;
  setMessage("");

  try {
    const res = await api.post(
      "/admin/download-data",
      {
        password,
      },
      {
        responseType: "blob",
      }
    );

    const url = window.URL.createObjectURL(res.data);
    const link = document.createElement("a");

    link.href = url;
    link.download = getDownloadFilename(res.headers);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    setMessage("Database download started.", "success");
  } catch (error) {
    console.error("Failed to download database", error);

    if (error.response?.status === 401) {
      setMessage("Invalid password.", "error");
    } else {
      setMessage("Database download failed.", "error");
    }
  } finally {
    downloading.value = false;
  }
}
</script>

<template>
  <div class="admin-page">
    <div class="admin-header">
      <div>
        <h1>Admin Panel</h1>
        <p>Run backend maintenance actions and export database data.</p>
      </div>
    </div>

    <div class="admin-grid">
      <section class="admin-section">
        <div>
          <h2>Sync Data</h2>
          <p>Refresh room status from ICS calendars and long term lease data.</p>
        </div>

        <div class="admin-actions">
          <button
            @click="syncIcs"
            :disabled="syncingIcs || syncingLongterm || downloading"
          >
            {{ syncingIcs ? "Syncing..." : "Sync ICS" }}
          </button>

          <button
            @click="syncLongterm"
            :disabled="syncingIcs || syncingLongterm || downloading"
          >
            {{ syncingLongterm ? "Syncing..." : "Sync Long Term" }}
          </button>
        </div>
      </section>

      <section class="admin-section">
        <div>
          <h2>Database Export</h2>
          <p>Download a JSON backup of properties, units, and rooms.</p>
        </div>

        <div class="admin-actions">
          <button
            class="secondary-button"
            @click="downloadDatabase"
            :disabled="syncingIcs || syncingLongterm || downloading"
          >
            {{ downloading ? "Downloading..." : "Download Database" }}
          </button>
        </div>
      </section>
    </div>

    <div
      v-if="message"
      class="admin-message"
      :class="messageType"
    >
      {{ message }}
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  padding: 28px;
  background: var(--parchment);
  min-height: calc(100vh - 52px);
}

.admin-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 28px;
}

.admin-header h1 {
  font-size: 26px;
  letter-spacing: -0.4px;
}

.admin-header p,
.admin-section p {
  margin: 6px 0 0;
  color: var(--ink-3);
  font-size: 14px;
}

.admin-grid {
  display: grid;
  gap: 14px;
}

.admin-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px;
  background: var(--surface);
  border: 1px solid var(--linen);
  border-radius: var(--r-md);
  text-align: left;
  box-shadow: var(--shadow-xs);
}

.admin-section h2 {
  margin: 0;
  font-size: 16px;
  letter-spacing: -0.2px;
}

.admin-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.admin-actions button {
  padding: 9px 18px;
  border: none;
  background: var(--ink);
  color: var(--parchment);
  border-radius: var(--r-sm);
  cursor: pointer;
  font-weight: 700;
  font-size: 13px;
  min-height: 38px;
  transition: opacity 0.15s;
}

.admin-actions button:hover { opacity: 0.85; }
.admin-actions button:disabled { opacity: 0.45; cursor: not-allowed; }

.secondary-button {
  background: var(--s-booking-ink) !important;
}

.admin-message {
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: var(--r-sm);
  background: var(--surface-2);
  color: var(--ink-2);
  text-align: left;
  font-size: 14px;
  border: 1px solid var(--linen);
}

.admin-message.success {
  background: var(--s-cleaned-bg);
  color: var(--s-cleaned-ink);
  border-color: #b8d8c4;
}

.admin-message.error {
  background: var(--s-error-bg);
  color: var(--s-error-ink);
  border-color: #e8b4ae;
}

@media (max-width: 760px) {
  .admin-section {
    align-items: stretch;
    flex-direction: column;
  }

  .admin-actions {
    justify-content: stretch;
  }

  .admin-actions button {
    flex: 1 1 180px;
  }
}
</style>
