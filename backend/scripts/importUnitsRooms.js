const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const prisma = require("../src/prisma");

/**
 * Import Units and Rooms from CSV.
 *
 * Logic:
 * - Property column matches existing Property.name
 * - Property_Address column creates/finds Unit
 * - Room_Number column creates/finds Room
 * - ICS_URL creates/updates a Room ListingUrl normally
 * - Listing_Status goes to Room.status normally
 * - Listing_Name goes to Room.listingName
 * - appfolioName = Unit Name - Room Name
 *
 * Special case:
 * - If Room_Number is "Whole Unit":
 *   - save ICS_URL to a Unit ListingUrl
 *   - save Listing_Status to Unit.status
 *   - do NOT create a Room named "Whole Unit"
 */

const FILE_PATH = path.join(__dirname, "../data/ImportData - Unit & Rooms.csv");

const DEFAULT_UNIT_NAME = "Default Unit";
const DEFAULT_STATUS = "Available";
const WHOLE_UNIT_VALUE = "Whole Unit";

function clean(value) {
  if (value === undefined || value === null) return "";

  return String(value)
    .replace(/^\uFEFF/, "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isWholeUnit(roomName) {
  return clean(roomName).toLowerCase() === WHOLE_UNIT_VALUE.toLowerCase();
}

function buildAppfolioName(unitName, roomName) {
  return `${clean(unitName)} - ${clean(roomName)}`;
}

function detectChannel(url) {
  const value = clean(url).toLowerCase();

  if (value.includes("booking.com") || value.includes("admin.booking")) {
    return "Booking.com";
  }

  if (value.includes("airbnb.com")) {
    return "Airbnb";
  }

  if (value.includes("vrbo.com")) {
    return "VRBO";
  }

  return "Unknown";
}

function extractAirbnbListingId(url) {
  const match = clean(url).match(/\/calendar\/ical\/(\d+)\.ics/i);
  return match ? match[1] : null;
}

function extractChannelListingId(url, channel) {
  // 目前只有 Airbnb ICS URL 可以稳定解析出渠道侧 listing id。
  // Booking.com 如果后续有明确 ID 来源，再在这里扩展。
  if (channel === "Airbnb") return extractAirbnbListingId(url);
  return null;
}

function getValue(row, possibleKeys) {
  for (const key of possibleKeys) {
    if (row[key] !== undefined) {
      return clean(row[key]);
    }
  }

  return "";
}

function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

async function findOrCreateUnit({ propertyId, unitName }) {
  const existingUnit = await prisma.unit.findFirst({
    where: {
      propertyId,
      name: unitName,
    },
  });

  if (existingUnit) return existingUnit;

  const newUnit = await prisma.unit.create({
    data: {
      propertyId,
      name: unitName,
    },
  });

  console.log(`Created Unit: ${unitName}`);

  return newUnit;
}

async function createOrUpdateListingUrl({ roomId, unitId, url }) {
  if (!url) return null;
  const channel = detectChannel(url);
  const listingId = extractChannelListingId(url, channel);

  const where = roomId
    ? {
        roomId,
      }
    : {
        unitId,
      };

  const existingListing = await prisma.listingUrl.findFirst({
    where: {
      ...where,
      url,
    },
  });

  if (existingListing) {
    await prisma.listingUrl.updateMany({
      where,
      data: {
        isPrimary: false,
      },
    });

    return prisma.listingUrl.update({
      where: {
        id: existingListing.id,
      },
      data: {
        channel,
        listingId,
        status: "active",
        isPrimary: true,
      },
    });
  }

  await prisma.listingUrl.updateMany({
    where,
    data: {
      isPrimary: false,
    },
  });

  return prisma.listingUrl.create({
    data: {
      ...where,
      url,
      channel,
      listingId,
      status: "active",
      isPrimary: true,
    },
  });
}

async function findOrCreateRoom({
  unitId,
  unitName,
  roomName,
  url,
  status,
  listingName,
}) {
  const appfolioName = buildAppfolioName(unitName, roomName);

  const existingRoom = await prisma.room.findFirst({
    where: {
      unitId,
      name: roomName,
    },
  });

  if (existingRoom) {
    const updatedRoom = await prisma.room.update({
      where: {
        id: existingRoom.id,
      },
      data: {
        status: status || existingRoom.status,
        listingName: listingName || existingRoom.listingName,
        appfolioName,
      },
    });

    console.log(`Updated Room: ${appfolioName}`);

    await createOrUpdateListingUrl({
      roomId: updatedRoom.id,
      url,
    });

    return updatedRoom;
  }

  const newRoom = await prisma.room.create({
    data: {
      unitId,
      name: roomName,
      status: status || DEFAULT_STATUS,
      listingName: listingName || null,
      appfolioName,
    },
  });

  console.log(`Created Room: ${appfolioName}`);

  await createOrUpdateListingUrl({
    roomId: newRoom.id,
    url,
  });

  return newRoom;
}

async function importUnitsRooms() {
  const rows = await readCsv(FILE_PATH);

  console.log(`Found ${rows.length} rows`);

  let createdOrUpdatedCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    const propertyName = getValue(row, [
      "Property",
      "Property Name",
      "property",
      "propertyName",
    ]);

    const unitNameRaw = getValue(row, [
      "Property_Address",
      "property_Address",
      "Property Address",
      "Unit",
      "unit",
    ]);

    const roomName = getValue(row, [
      "Room_Number",
      "room_Number",
      "Room Number",
      "Room",
      "room",
    ]);

    const url = getValue(row, [
      "ICS_URL",
      "ICS URL",
      "URL",
      "url",
    ]);

    const listingStatus = getValue(row, [
      "Listing_Status",
      "Listing Status",
      "status",
      "Status",
    ]);

    const listingName = getValue(row, [
      "Listing_Name",
      "Listing Name",
      "listingName",
    ]);

    if (!propertyName) {
      console.log("Skipped row: missing property name");
      skippedCount++;
      continue;
    }

    const property = await prisma.property.findFirst({
      where: {
        name: propertyName,
      },
    });

    if (!property) {
      console.log(`Skipped row: Property not found -> ${propertyName}`);
      skippedCount++;
      continue;
    }

    const unitName = unitNameRaw || DEFAULT_UNIT_NAME;

    const unit = await findOrCreateUnit({
      propertyId: property.id,
      unitName,
    });

    if (isWholeUnit(roomName)) {
      await prisma.unit.update({
        where: {
          id: unit.id,
        },
        data: {
          // Whole Unit 的出租展示状态走远程新增的 AvailabilityStatus，
          // 避免和 Room.status / cleaningStatus 混在一起。
          AvailabilityStatus:
            listingStatus || unit.AvailabilityStatus || DEFAULT_STATUS,
        },
      });

      await createOrUpdateListingUrl({
        unitId: unit.id,
        url,
      });

      console.log(`Updated Whole Unit: ${propertyName} / ${unitName}`);
      createdOrUpdatedCount++;
      continue;
    }

    if (!roomName) {
      console.log(
        `Skipped row: missing room name -> ${propertyName} / ${unitName}`
      );
      skippedCount++;
      continue;
    }

    await findOrCreateRoom({
      unitId: unit.id,
      unitName,
      roomName,
      url,
      status: listingStatus || DEFAULT_STATUS,
      listingName,
    });

    createdOrUpdatedCount++;
  }

  console.log("\n========== IMPORT SUMMARY ==========");
  console.log(`Created / Updated: ${createdOrUpdatedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log("Import completed");

  await prisma.$disconnect();
}

importUnitsRooms().catch(async (error) => {
  console.error("Import failed:");
  console.error(error);

  await prisma.$disconnect();
  process.exit(1);
});
