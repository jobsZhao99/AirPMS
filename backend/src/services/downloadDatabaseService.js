const prisma = require("../prisma");

async function downloadAllDatabaseData() {
  // 导出所有核心表，方便线上数据做人工备份或交接排查。
  const [properties, units, rooms, listingUrls, bookingRecords] =
    await Promise.all([
      prisma.property.findMany({
        orderBy: {
          name: "asc",
        },
      }),
      prisma.unit.findMany({
        orderBy: [
          {
            propertyId: "asc",
          },
          {
            name: "asc",
          },
        ],
      }),
      prisma.room.findMany({
        orderBy: [
          {
            unitId: "asc",
          },
          {
            name: "asc",
          },
        ],
      }),
      prisma.listingUrl.findMany({
        orderBy: [
          {
            roomId: "asc",
          },
          {
            unitId: "asc",
          },
          {
            isPrimary: "desc",
          },
          {
            channel: "asc",
          },
        ],
      }),
      prisma.bookingRecord.findMany({
        orderBy: [
          {
            startDate: "desc",
          },
          {
            endDate: "desc",
          },
        ],
      }),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    tables: {
      properties,
      units,
      rooms,
      listingUrls,
      bookingRecords,
    },
  };
}

module.exports = {
  downloadAllDatabaseData,
};
