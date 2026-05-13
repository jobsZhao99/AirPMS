const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const prisma = require("../prisma");

const FILE_PATH = path.join(
  __dirname,
  "../../data/Tenant Directory.csv"
);

const LONG_TERM_MARKER = "LT:";

function clean(value) {
  if (value === undefined || value === null) return "";

  return String(value)
    .replace(/^\uFEFF/, "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUnitKey(value) {
  return clean(value)
    .replace(/\./g, "")
    .replace(/\bwest\b/gi, "w")
    .replace(/\beast\b/gi, "e")
    .replace(/\bnorth\b/gi, "n")
    .replace(/\bsouth\b/gi, "s")
    .replace(/\bstreet\b/gi, "st")
    .replace(/\bplace\b/gi, "pl")
    .replace(/\bavenue\b/gi, "ave")
    .replace(/\bdrive\b/gi, "dr")
    .replace(/\bboulevard\b/gi, "blvd")
    .replace(/\broad\b/gi, "rd")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function shouldSkipTenant(tenantName) {
  const value = clean(tenantName).toLowerCase();

  return value.includes("airbnb") || value.includes("booking");
}

function isShortTermRentedStatus(status) {
  const value = clean(status).toLowerCase();

  return (
    value.includes("airbnb rented") ||
    value.includes("booking.com rented")
  );
}

function formatDate(value) {
  const text = clean(value);
  if (!text) return "";

  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return text;

  const month = match[1].padStart(2, "0");
  const day = match[2].padStart(2, "0");
  const year = match[3];

  return `${year}-${month}-${day}`;
}

function mergeNotes(existingNote, longTermNote) {
  const oldNote = clean(existingNote);
  const newNote = clean(longTermNote);

  if (!oldNote) {
    return `${LONG_TERM_MARKER}\n\n${newNote}`;
  }

  if (!newNote) {
    return oldNote;
  }

  if (oldNote.includes(LONG_TERM_MARKER)) {
    const beforeLongTerm = oldNote
      .split(LONG_TERM_MARKER)[0]
      .trim();

    return [
      beforeLongTerm,
      LONG_TERM_MARKER,
      newNote,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return [
    oldNote,
    LONG_TERM_MARKER,
    newNote,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function findHeaderRow(records) {
  return records.findIndex((row) => {
    const cleaned = row.map(clean);

    return (
      cleaned.includes("Property ID") &&
      cleaned.includes("Property Name") &&
      cleaned.includes("Unit") &&
      cleaned.includes("Tenant")
    );
  });
}

function getColIndex(header, name) {
  return header.findIndex((cell) => clean(cell) === name);
}

function buildTenantNote(lease) {
  const termStart = formatDate(lease.leaseFrom || lease.moveIn);
  const termEnd = formatDate(lease.leaseTo || lease.moveOut);

  return [
    `Unit: ${lease.unit}`,
    `Tenant: ${lease.tenant}`,
    `Status: ${lease.status}`,
    `Term: ${termStart} - ${termEnd}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function syncLongTermLeases() {
  const content = fs.readFileSync(FILE_PATH, "utf-8");

  const records = parse(content, {
    delimiter: ",",
    relax_column_count: true,
    skip_empty_lines: false,
  });

  const headerRowIndex = findHeaderRow(records);

  if (headerRowIndex === -1) {
    throw new Error("Tenant Directory header row not found.");
  }

  const header = records[headerRowIndex].map(clean);

  const unitCol = getColIndex(header, "Unit");
  const tenantCol = getColIndex(header, "Tenant");
  const statusCol = getColIndex(header, "Status");
  const moveInCol = getColIndex(header, "Move-in");
  const moveOutCol = getColIndex(header, "Move-out");
  const leaseFromCol = getColIndex(header, "Lease From");
  const leaseToCol = getColIndex(header, "Lease To");

  if (unitCol === -1 || tenantCol === -1) {
    throw new Error("Tenant Directory missing Unit or Tenant column.");
  }

  const leaseMap = new Map();

  for (let i = headerRowIndex + 1; i < records.length; i++) {
    const row = records[i];

    const unit = clean(row[unitCol]);
    const tenant = clean(row[tenantCol]);

    if (!unit || !tenant) continue;
    if (shouldSkipTenant(tenant)) continue;

    const key = normalizeUnitKey(unit);

    const lease = {
      unit,
      tenant,
      status: statusCol !== -1 ? clean(row[statusCol]) : "",
      moveIn: moveInCol !== -1 ? clean(row[moveInCol]) : "",
      moveOut: moveOutCol !== -1 ? clean(row[moveOutCol]) : "",
      leaseFrom: leaseFromCol !== -1 ? clean(row[leaseFromCol]) : "",
      leaseTo: leaseToCol !== -1 ? clean(row[leaseToCol]) : "",
    };

    if (!leaseMap.has(key)) {
      leaseMap.set(key, []);
    }

    leaseMap.get(key).push(lease);
  }

  const rooms = await prisma.room.findMany({
    where: {
      appfolioName: {
        not: null,
      },
    },
  });

  let updatedLongTerm = 0;
  let mergedWithShortTerm = 0;
  let noMatch = 0;

  for (const room of rooms) {
    const roomKey = normalizeUnitKey(room.appfolioName);
    const matchedLeases = leaseMap.get(roomKey);

    if (!matchedLeases || !matchedLeases.length) {
      noMatch++;
      continue;
    }

    const longTermNote = matchedLeases
      .map(buildTenantNote)
      .join("\n\n");

    const keepShortTermStatus = isShortTermRentedStatus(room.status);

    const newStatus = keepShortTermStatus ? room.status : "Long Term";

    const newNote = keepShortTermStatus
      ? mergeNotes(room.note, longTermNote)
      : `${LONG_TERM_MARKER}\n\n${longTermNote}`;

    await prisma.room.update({
      where: {
        id: room.id,
      },
      data: {
        status: newStatus,
        note: newNote,
      },
    });

    if (keepShortTermStatus) {
      mergedWithShortTerm++;
    } else {
      updatedLongTerm++;
    }
  }

  return {
    longTermKeysFound: leaseMap.size,
    roomsChecked: rooms.length,
    updatedLongTerm,
    mergedWithShortTerm,
    noMatch,
  };
}

module.exports = {
  syncLongTermLeases,
};