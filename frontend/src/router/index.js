import { createRouter, createWebHistory } from "vue-router";
import Dashboard from "../views/Dashboard.vue";
import AdminPanel from "../views/AdminPanel.vue";
import RoomProfile from "../views/RoomProfile.vue";

const routes = [
  { path: "/", component: Dashboard },
  { path: "/admin", component: AdminPanel },
  // 复用远程“点击房间进入详情”的体验，只在详情页上补充管理能力。
  { path: "/rooms/:id", component: RoomProfile },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
