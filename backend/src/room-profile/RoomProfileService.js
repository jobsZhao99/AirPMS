const repo = require("./RoomProfileRepository");
const { parseAirbnbICSEvents, parseBookingICSEvents, detectIcsSource } = require("../utils/ics");

// --- URL parsing helpers ---

function extractAirbnbListingId(url) {
  const match = String(url || "").match(/\/calendar\/ical\/(\d+)\.ics/);
  return match ? match[1] : null;
}

function extractChannelListingId(url, channel) {
  if (channel === "Airbnb") return extractAirbnbListingId(url);
  return null;
}

function buildAirbnbLinks(listingId) {
  if (!listingId) return null;
  return {
    listingPage: `https://www.airbnb.com/rooms/${listingId}`,
    hostManagePage: `https://www.airbnb.com/hosting/listings/${listingId}`,
  };
}

function buildReservationLink(channel, confirmationCode) {
  if (!confirmationCode) return null;
  if (channel === "Airbnb") {
    return `https://www.airbnb.com/hosting/reservations/details/${confirmationCode}`;
  }
  return null;
}

// Fetch ICS live and return the active (today-or-future) reservation with UID.
// Used only when viewing a room profile — not part of the sync pipeline.
async function fetchCurrentReservation(url, channel) {
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) return null;
    const icsText = await response.text();
    if (!icsText.includes("BEGIN:VCALENDAR")) return null;

    const events =
      channel === "Booking.com"
        ? parseBookingICSEvents(icsText)
        : parseAirbnbICSEvents(icsText);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const active = events
      .filter((e) => e.end >= today)
      .sort((a, b) => a.start - b.start)[0];

    if (!active) return null;
    return {
      checkIn: active.start,
      checkOut: active.end,
      confirmationCode: active.uid || null,
      reservationLink: buildReservationLink(channel, active.uid),
    };
  } catch {
    return null;
  }
}

// --- Profile assembly ---

function decorateListingUrl(listing) {
  const channel = listing.channel;
  const listingId = listing.listingId || extractChannelListingId(listing.url, channel);
  const links = channel === "Airbnb" ? buildAirbnbLinks(listingId) : null;
  return { ...listing, listingId, links };
}

async function getRoomProfile(roomId) {
  const room = await repo.getRoomById(roomId);
  if (!room) return null;

  const listingUrls = room.listingUrls.map(decorateListingUrl);

  // Fetch live reservation only for the primary active Airbnb URL
  const primaryAirbnb = listingUrls.find(
    (u) => u.isPrimary && u.status === "active" && u.channel === "Airbnb"
  );

  let currentReservation = null;
  if (primaryAirbnb) {
    currentReservation = await fetchCurrentReservation(primaryAirbnb.url, "Airbnb");
  }

  return {
    id: room.id,
    name: room.name,
    listingName: room.listingName,
    appfolioName: room.appfolioName,
    status: room.status,
    cleaningStatus: room.cleaningStatus,
    leasingStatus: room.leasingStatus,
    note: room.note,
    adminNotes: room.adminNotes,
    unit: room.unit,
    listingUrls,
    currentReservation,
  };
}

async function addListingUrl(roomId, { url, channel, notes }) {
  const detectedChannel = channel || detectIcsSource(url) || "Unknown";
  const listingId = extractChannelListingId(url, detectedChannel);

  const existing = await repo.getRoomById(roomId);
  const hasNoPrimary = !existing?.listingUrls?.some(
    (u) => u.isPrimary && u.status === "active"
  );

  return repo.createListingUrl({
    url,
    channel: detectedChannel,
    notes: notes || null,
    listingId,
    isPrimary: hasNoPrimary,
    status: "active",
    roomId,
  });
}

async function setPrimaryListingUrl(roomId, urlId) {
  const listing = await repo.getListingUrlById(urlId);
  if (!listing || listing.roomId !== roomId) {
    throw new Error("Listing URL not found for this room");
  }
  return repo.setPrimaryUrl(roomId, urlId);
}

async function updateListingUrl(roomId, urlId, { url, channel, notes }) {
  const current = await repo.getListingUrlById(urlId);
  if (!current) {
    throw new Error("Listing URL not found");
  }
  if (current.roomId !== roomId) {
    throw new Error("Listing URL not found for this room");
  }

  const data = {};
  const nextUrl = url !== undefined ? url : current.url;
  const nextChannel =
    channel !== undefined
      ? channel || detectIcsSource(nextUrl) || "Unknown"
      : current.channel;

  if (url !== undefined || channel !== undefined) {
    // URL 或渠道变更时同步刷新 listingId，Airbnb 管理链接才能保持准确。
    if (url !== undefined) data.url = url;
    data.channel = nextChannel;
    data.listingId = extractChannelListingId(nextUrl, nextChannel);
  }
  if (notes !== undefined) data.notes = notes;
  return repo.updateListingUrl(urlId, data);
}

async function deactivateListingUrl(roomId, urlId) {
  const listing = await repo.getListingUrlById(urlId);
  if (!listing || listing.roomId !== roomId) {
    throw new Error("Listing URL not found for this room");
  }
  return repo.deactivateListingUrl(urlId);
}

async function updateAdminNotes(roomId, adminNotes) {
  return repo.updateAdminNotes(roomId, adminNotes);
}

module.exports = {
  getRoomProfile,
  addListingUrl,
  setPrimaryListingUrl,
  updateListingUrl,
  deactivateListingUrl,
  updateAdminNotes,
};
