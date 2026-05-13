<script setup>
import { ref } from "vue";
import Dashboard from "./views/Dashboard.vue";
import AdminPanel from "./views/AdminPanel.vue";

const activePage = ref("dashboard");
</script>

<template>
  <div class="app-shell">
    <nav class="app-nav">
      <button
        :class="{ active: activePage === 'dashboard' }"
        @click="activePage = 'dashboard'"
      >
        Dashboard
      </button>

      <button
        :class="{ active: activePage === 'admin' }"
        @click="activePage = 'admin'"
      >
        Admin Panel
      </button>
    </nav>

    <Dashboard v-if="activePage === 'dashboard'" />
    <AdminPanel v-else />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: #f7f8fa;
}

.app-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  gap: 8px;
  padding: 12px 24px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
}

.app-nav button {
  padding: 8px 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #ffffff;
  color: #374151;
  cursor: pointer;
}

.app-nav button.active {
  border-color: #111827;
  background: #111827;
  color: #ffffff;
}
</style>
