<template>
  <div class="app-shell">
    <nav class="app-nav">
      <span class="nav-brand">Air-Pulse</span>
      <RouterLink to="/" class="nav-link">Dashboard</RouterLink>
      <RouterLink to="/admin" class="nav-link">Admin</RouterLink>
    </nav>
    <RouterView />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--parchment);
}

.app-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  height: 52px;
  padding: 0 28px;
  background: var(--surface);
  border-bottom: 1px solid var(--linen);
  box-shadow: var(--shadow-xs);
}

.nav-brand {
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 700;
  color: var(--ink);
  margin-right: 24px;
  letter-spacing: -0.3px;
  flex-shrink: 0;
}

.nav-link {
  height: 52px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  text-decoration: none;
  color: var(--ink-2);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.01em;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}

.nav-link:hover {
  color: var(--ink);
  border-bottom-color: var(--linen-2);
}

.nav-link.router-link-active {
  color: var(--ink);
  border-bottom-color: var(--ink);
}
</style>
