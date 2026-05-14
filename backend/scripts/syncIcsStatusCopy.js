const prisma = require("../src/prisma");
const { getRecentStayFromICS } = require("../src/utils/ics");

/**
 * Sync ICS status for:
 * - Rooms with primary active ListingUrl
 * - Units with primary active ListingUrl
 *
 * Rule:
 * - Normal room listing: save status/note on Room
 * - Whole Unit listing: save status/note on Unit
 */

async function syncRoomIcsStatus() {
  const listings = await prisma.listingUrl.findMany({
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

  console.log(`Found ${listings.length} rooms with primary active ICS URL`);

  let synced = 0;
  let failed = 0;

  for (const listing of listings) {
    const room = listing.room;

    try {
      const result = await getRecentStayFromICS(listing.url);

      await prisma.room.update({
        where: {
          id: room.id,
        },
        data: {
          status: result.status,
          note: result.note,
        },
      });

      console.log(
        `Room synced: ${room.unit.property.name} / ${room.unit.name} / ${room.name} -> ${result.status}`
      );

      synced++;
    } catch (error) {
      await prisma.room.update({
        where: {
          id: room.id,
        },
        data: {
          status: "ICS Error",
          note: error.message,
        },
      });

      console.log(`Room sync failed: ${room.name} -> ${error.message}`);
      failed++;
    }
  }

  return {
    synced,
    failed,
  };
}

async function syncUnitIcsStatus() {
  const listings = await prisma.listingUrl.findMany({
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

  console.log(`Found ${listings.length} units with primary active ICS URL`);

  let synced = 0;
  let failed = 0;

  for (const listing of listings) {
    const unit = listing.unit;

    try {
      const result = await getRecentStayFromICS(listing.url);

      await prisma.unit.update({
        where: {
          id: unit.id,
        },
        data: {
          AvailabilityStatus: result.status,
          note: result.note,
        },
      });

      console.log(
        `Unit synced: ${unit.property.name} / ${unit.name} -> ${result.status}`
      );

      synced++;
    } catch (error) {
      await prisma.unit.update({
        where: {
          id: unit.id,
        },
        data: {
          AvailabilityStatus: "ICS Error",
          note: error.message,
        },
      });

      console.log(`Unit sync failed: ${unit.name} -> ${error.message}`);
      failed++;
    }
  }

  return {
    synced,
    failed,
  };
}

async function main() {
  console.log("Starting ICS sync...");

  const roomResult = await syncRoomIcsStatus();
  const unitResult = await syncUnitIcsStatus();

  console.log("\n========== ICS SYNC SUMMARY ==========");
  console.log(`Rooms synced: ${roomResult.synced}`);
  console.log(`Rooms failed: ${roomResult.failed}`);
  console.log(`Units synced: ${unitResult.synced}`);
  console.log(`Units failed: ${unitResult.failed}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("ICS sync failed:");
  console.error(error);

  await prisma.$disconnect();
  process.exit(1);
});
