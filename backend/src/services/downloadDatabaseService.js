const prisma = require("../prisma");

async function downloadAllDatabaseData() {
  const [properties, units, rooms, listingUrls] = await Promise.all([
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
  ]);

  return {
    exportedAt: new Date().toISOString(),
    tables: {
      properties,
      units,
      rooms,
      listingUrls,
    },
  };
}

module.exports = {
  downloadAllDatabaseData,
};
