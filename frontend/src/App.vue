<template>
  <div class="app-shell">
    <nav class="app-nav">
      <RouterLink to="/" class="nav-link">
        Dashboard
      </RouterLink>

      <RouterLink to="/admin" class="nav-link">
        Admin Panel
      </RouterLink>
    </nav>

    <!-- 路由只负责页面承载：Dashboard 仍是远程原来的入口，
         点击房间后进入增强版 Room Details。 -->
    <RouterView />
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

.nav-link {
  padding: 8px 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #ffffff;
  color: #374151;
  cursor: pointer;
  text-decoration: none;
  font-size: 14px;
}

.nav-link.router-link-active {
  border-color: #111827;
  background: #111827;
  color: #ffffff;
}
</style>
