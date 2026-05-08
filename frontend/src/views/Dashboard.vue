<script setup>
import { ref, onMounted } from "vue";
import api from "../api";

const properties = ref([]);
const loading = ref(false);

/**
 * 从房间名里提取数字
 * 例如：
 * Rm 101 -> 101
 * Rm 1 -> 1
 * Room 12 -> 12
 */
function getRoomNumber(roomName) {
  const match = String(roomName).match(/\d+/);
  return match ? Number(match[0]) : null;
}

/**
 * 判断是否是三位数房间：
 * Rm 101 / Rm 205 / Rm 401
 */
function isThreeDigitRoom(room) {
  const num = getRoomNumber(room.name);
  return num >= 100 && num <= 999;
}

/**
 * 判断是否全部都是三位数房间
 */
function allRoomsAreThreeDigit(rooms) {
  if (!rooms.length) return false;
  return rooms.every(isThreeDigitRoom);
}

/**
 * 房间排序：按数字从小到大
 */
function sortRooms(rooms) {
  return [...rooms].sort((a, b) => {
    const numA = getRoomNumber(a.name);
    const numB = getRoomNumber(b.name);

    if (numA !== null && numB !== null) {
      return numA - numB;
    }

    return a.name.localeCompare(b.name);
  });
}

/**
 * 每 8 个房间一行
 */
function chunkRooms(rooms, size = 8) {
  const result = [];

  for (let i = 0; i < rooms.length; i += size) {
    result.push(rooms.slice(i, i + size));
  }

  return result;
}

/**
 * 核心排列逻辑
 *
 * 情况 1：
 * Unit 下面没有房间 -> 一整行只显示 Unit
 *
 * 情况 2：
 * 房间都是 Rm 101 / 201 / 301 这种三位数
 * -> 按楼层分组：100 / 200 / 300 / 400
 *
 * 情况 3：
 * Rm 1 / Rm 12 这种
 * -> 从小到大，每 8 个一行
 */
function buildUnitRows(unit) {
  const rooms = sortRooms(unit.rooms || []);

  if (!rooms.length) {
    return [
      {
        unit,
        rooms: [],
        type: "unitOnly",
      },
    ];
  }

  if (allRoomsAreThreeDigit(rooms)) {
    const floorMap = {};

    for (const room of rooms) {
      const roomNumber = getRoomNumber(room.name);
      const floor = Math.floor(roomNumber / 100);

      if (!floorMap[floor]) {
        floorMap[floor] = [];
      }

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
    <div class="page-header">
      <h1>AirPMS Inventory Dashboard</h1>
      <button @click="loadDashboard">Refresh</button>
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
          v-for="unit in property.units"
          :key="unit.id"
        >
          <div
            v-for="(row, rowIndex) in buildUnitRows(unit)"
            :key="`${unit.id}-${rowIndex}`"
            class="inventory-row"
          >
            <!-- 第一列：Unit -->
            <div
              class="unit-cell"
              :class="{ muted: rowIndex > 0 }"
            >
              <span v-if="rowIndex === 0">
                {{ unit.name }}
              </span>
            </div>

            <!-- 情况 1：没有房间 -->
            <div
              v-if="row.type === 'unitOnly'"
              class="room-cell empty-room-cell"
            >
              No rooms
            </div>

            <!-- 情况 2 / 3：显示房间 -->
            <div
              v-for="room in row.rooms"
              :key="room.id"
              class="room-cell"
              :class="room.status?.toLowerCase()"
            >
              <div class="room-name">
                {{ room.name }}
              </div>

              <div class="room-status">
                {{ room.status }}
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
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
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  margin: 0;
}

.page-header button {
  padding: 8px 16px;
  border: none;
  background: #111827;
  color: white;
  border-radius: 6px;
  cursor: pointer;
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
  min-height: 58px;
  border-bottom: 1px solid #e5e7eb;
}

.inventory-row:last-child {
  border-bottom: none;
}

.unit-cell {
  width: 180px;
  min-width: 180px;
  padding: 12px;
  border-right: 1px solid #e5e7eb;
  background: #f3f4f6;
  font-weight: 600;
  display: flex;
  align-items: center;
}

.unit-cell.muted {
  color: transparent;
}

.room-cell {
  width: 120px;
  min-width: 120px;
  padding: 8px;
  border-right: 1px solid #e5e7eb;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.room-name {
  font-weight: 600;
  font-size: 14px;
}

.room-status {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.empty-room-cell {
  color: #9ca3af;
  font-style: italic;
}

.room-cell.available {
  background: #ecfdf5;
}

.room-cell.occupied {
  background: #fee2e2;
}

.room-cell.maintenance {
  background: #fef3c7;
}

.room-cell.offline {
  background: #e5e7eb;
}
</style>