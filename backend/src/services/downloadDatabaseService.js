const prisma = require("../prisma");

async function downloadAllDatabaseData() {
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
