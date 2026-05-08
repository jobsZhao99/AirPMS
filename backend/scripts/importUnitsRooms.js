const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const prisma = require("../src/prisma");

/**
 * Import Units and Rooms from CSV.
 *
 * Expected logic:
 * - Column A / Property Name: match existing Property.name
 * - Column E / Unit: create or find Unit under Property
 * - Column F / Room: create or find Room under Unit
 * - ICS_URL: save to Room.url normally
 * - Listing_Status: save to Room.status normally
 * - If Room is "Whole Unit":
 *    - save ICS_URL to Unit.url
 *    - save Listing_Status to Unit.status
 *    - DO NOT create a Room named "Whole Unit"
 */

const FILE_PATH = path.join(__dirname, "../data/ImportData - Unit & Rooms.csv");

const DEFAULT_UNIT_NAME = "Default Unit";
const DEFAULT_STATUS = "Available";
const WHOLE_UNIT_VALUE = "Whole Unit";

/**
 * Clean cell value.
 */
function clean(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

/**
 * Case-insensitive Whole Unit check.
 */
function isWholeUnit(roomName) {
  return clean(roomName).toLowerCase() === WHOLE_UNIT_VALUE.toLowerCase();
}

/**
 * Get value from row by possible header names.
 * This lets the script work even if your CSV header names are slightly different.
 */
function getValue(row, possibleKeys) {
  for (const key of possibleKeys) {
    if (row[key] !== undefined) {
      return clean(row[key]);
    }
  }

  return "";
}

/**
 * Read CSV file into rows.
 */
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

/**
 * Find existing Unit under one Property, or create it.
 */
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

/**
 * Find existing Room under one Unit, or create it.
 */
async function findOrCreateRoom({ unitId, roomName, url, status, listingName }) {
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
        url: url || existingRoom.url,
        status: status || existingRoom.status,
        listingName: listingName || existingRoom.listingName,
      },
    });

    console.log(`Updated Room: ${roomName}`);

    return updatedRoom;
  }

  const newRoom = await prisma.room.create({
    data: {
      unitId,
      name: roomName,
      url: url || null,
      status: status || DEFAULT_STATUS,
      listingName: listingName || null,
    },
  });

  console.log(`Created Room: ${roomName}`);

  return newRoom;
}

async function importUnitsRooms() {
  const rows = await readCsv(FILE_PATH);

  console.log(`Found ${rows.length} rows`);

  let createdOrUpdatedCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    /**
     * Adjust these keys if your CSV header names are different.
     *
     * A column = Property name
     * E column = Unit
     * F column = Room
     * I column / ICS_URL = URL
     */
    const propertyName = getValue(row, [
      "Property",
      "Property Name",
      "property",
      "propertyName",
    ]);

    const unitNameRaw = getValue(row, [
      "Property_Address",
      "property_Address",
    ]);

    const roomName = getValue(row, [
      "Room_Number",
      "room_Number",
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

    /**
     * Special case:
     * If Room column says "Whole Unit",
     * URL and Status belong to Unit, not Room.
     */
    if (isWholeUnit(roomName)) {
      await prisma.unit.update({
        where: {
          id: unit.id,
        },
        data: {
          url: url || unit.url,
          status: listingStatus || unit.status || DEFAULT_STATUS,
        },
      });

      console.log(`Updated Whole Unit: ${propertyName} / ${unitName}`);
      createdOrUpdatedCount++;
      continue;
    }

    /**
     * Normal case:
     * Create Room under Unit.
     */
    if (!roomName) {
      console.log(`Skipped row: missing room name -> ${propertyName} / ${unitName}`);
      skippedCount++;
      continue;
    }

    await findOrCreateRoom({
      unitId: unit.id,
      roomName,
      url,
      status: listingStatus || DEFAULT_STATUS,
      listingName,
    });

    createdOrUpdatedCount++;
  }

  console.log("Import completed");
  console.log(`Created / Updated: ${createdOrUpdatedCount}`);
  console.log(`Skipped: ${skippedCount}`);

  await prisma.$disconnect();
}

importUnitsRooms().catch(async (error) => {
  console.error("Import failed:");
  console.error(error);

  await prisma.$disconnect();
  process.exit(1);
});