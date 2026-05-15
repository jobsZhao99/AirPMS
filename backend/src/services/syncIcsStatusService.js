const prisma = require("../prisma");
const { getRecentStayFromICS } = require("../utils/ics");

async function syncIcsStatus() {
  const roomListings = await prisma.listingUrl.findMany({
    where: {
      roomId: { not: null },
      isPrimary: true,
      status: "active",
    },
    include: {
      room: {
        include: {
          unit: {
            include: {
              property: true,
            },
          },
        },
      },
    },
  });

  const unitListings = await prisma.listingUrl.findMany({
    where: {
      unitId: { not: null },
      isPrimary: true,
      status: "active",
    },
    include: {
      unit: {
        include: {
          property: true,
        },
      },
    },
  });

  let roomsSynced = 0;
  let roomsFailed = 0;
  let unitsSynced = 0;
  let unitsFailed = 0;

  for (const listing of roomListings) {
    const room = listing.room;

    try {
      const result = await getRecentStayFromICS(listing.url);

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

  for (const listing of unitListings) {
    const unit = listing.unit;

    try {
      const result = await getRecentStayFromICS(listing.url);

      await prisma.unit.update({
        where: { id: unit.id },
        data: {
          // Unit 没有独立房间时，ICS 的出租状态写到 AvailabilityStatus。
          // Room.status 继续服务单间展示，leasingStatus/cleaningStatus 分开维护。
          AvailabilityStatus: result.status,
          note: result.note,
        },
      });

      unitsSynced++;
    } catch (error) {
      await prisma.unit.update({
        where: { id: unit.id },
        data: {
          AvailabilityStatus: "ICS Error",
          note: error.message,
        },
      });

      unitsFailed++;
    }
  }

  return {
    roomsFound: roomListings.length,
    roomsSynced,
    roomsFailed,
    unitsFound: unitListings.length,
    unitsSynced,
    unitsFailed,
  };
}

module.exports = {
  syncIcsStatus,
};
