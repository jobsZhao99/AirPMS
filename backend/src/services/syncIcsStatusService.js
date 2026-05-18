const prisma = require("../prisma");
const {
  detectIcsSource,
  parseAirbnbICSEvents,
  parseBookingICSEvents,
  deriveRoomStatus,
} = require("../utils/ics");

async function fetchAndParseEvents(url) {
  const source = detectIcsSource(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  let response;
  try {
    response = await fetch(url, { redirect: "follow", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const icsText = await response.text();

  if (!icsText.includes("BEGIN:VCALENDAR")) {
    throw new Error("Not ICS");
  }

  const events =
    source === "Booking.com"
      ? parseBookingICSEvents(icsText)
      : parseAirbnbICSEvents(icsText);

  return { events, source };
}

async function upsertBookingRecords(listing, events) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = events.filter((e) => e.end >= today);
  if (!upcoming.length) return;

  const codes = upcoming.map((e) => e.reservationCode).filter(Boolean);
  const ownerFilter = listing.roomId
    ? { roomId: listing.roomId }
    : { unitId: listing.unitId };

  const existingRecords = codes.length
    ? await prisma.bookingRecord.findMany({
        where: { reservationCode: { in: codes }, ...ownerFilter },
      })
    : [];

  const existingByCode = new Map(existingRecords.map((r) => [r.reservationCode, r]));

  for (const { reservationCode, guestId, start, end } of upcoming) {
    const existing = reservationCode ? existingByCode.get(reservationCode) : null;

    if (existing) {
      await prisma.bookingRecord.update({
        where: { id: existing.id },
        data: {
          guestId: guestId ?? existing.guestId,
          startDate: start,
          endDate: end,
          status: "Confirmed",
        },
      });
    } else {
      await prisma.bookingRecord.create({
        data: {
          reservationCode: reservationCode ?? null,
          guestId: guestId ?? null,
          startDate: start,
          endDate: end,
          status: "Confirmed",
          roomId: listing.roomId ?? null,
          unitId: listing.unitId ?? null,
          listingUrlId: listing.id,
        },
      });
    }
  }
}

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
      const { events, source } = await fetchAndParseEvents(listing.url);
      const { status, note } = deriveRoomStatus(events, source);

      await prisma.room.update({
        where: { id: room.id },
        data: { status, note },
      });

      await upsertBookingRecords(listing, events);

      roomsSynced++;
    } catch (error) {
      await prisma.room.update({
        where: { id: room.id },
        data: { status: "ICS Error", note: error.message },
      });

      roomsFailed++;
    }
  }

  for (const listing of unitListings) {
    const unit = listing.unit;

    try {
      const { events, source } = await fetchAndParseEvents(listing.url);
      const { status, note } = deriveRoomStatus(events, source);

      await prisma.unit.update({
        where: { id: unit.id },
        data: { AvailabilityStatus: status, note },
      });

      await upsertBookingRecords(listing, events);

      unitsSynced++;
    } catch (error) {
      await prisma.unit.update({
        where: { id: unit.id },
        data: { AvailabilityStatus: "ICS Error", note: error.message },
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
