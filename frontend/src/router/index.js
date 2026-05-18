import { createRouter, createWebHistory } from "vue-router";
import Dashboard from "../views/Dashboard.vue";
import AdminPanel from "../views/AdminPanel.vue";

const routes = [
  { path: "/", component: Dashboard },
  { path: "/admin", component: AdminPanel },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
