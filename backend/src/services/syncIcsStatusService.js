const prisma = require("../prisma");
const { getRecentStayFromICS } = require("../utils/ics");

async function syncIcsStatus() {
  const rooms = await prisma.room.findMany({
    where: { url: { not: null } },
    include: { unit: { include: { property: true } } },
  });

  const units = await prisma.unit.findMany({
    where: { url: { not: null } },
    include: { property: true },
  });

  let roomsSynced = 0;
  let roomsFailed = 0;
  let unitsSynced = 0;
  let unitsFailed = 0;

  for (const room of rooms) {
    try {
      const result = await getRecentStayFromICS(room.url);

      await prisma.room.update({
        where: { id: room.id },
        data: {
          status: result.status,
          note: result.note,
        },
      });

      roomsSynced++;
    } catch (error) {
      await prisma.room.update({
        where: { id: room.id },
        data: {
          status: "ICS Error",
          note: error.message,
        },
      });

      roomsFailed++;
    }
  }

  for (const unit of units) {
    try {
      const result = await getRecentStayFromICS(unit.url);

      await prisma.unit.update({
        where: { id: unit.id },
        data: {
          status: result.status,
          note: result.note,
        },
      });

      unitsSynced++;
    } catch (error) {
      await prisma.unit.update({
        where: { id: unit.id },
        data: {
          status: "ICS Error",
          note: error.message,
        },
      });

      unitsFailed++;
    }
  }

  return {
    roomsFound: rooms.length,
    roomsSynced,
    roomsFailed,
    unitsFound: units.length,
    unitsSynced,
    unitsFailed,
  };
}

module.exports = {
  syncIcsStatus,
};