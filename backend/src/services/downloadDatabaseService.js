const prisma = require("../prisma");

async function downloadAllDatabaseData() {
  const [properties, units, rooms] = await Promise.all([
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
  ]);

  return {
    exportedAt: new Date().toISOString(),
    tables: {
      properties,
      units,
      rooms,
    },
  };
}

module.exports = {
  downloadAllDatabaseData,
};
