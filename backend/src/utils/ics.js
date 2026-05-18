/**
 * ICS parsing utilities for AirPMS.
 *
 * Airbnb:
 * - SUMMARY:Reserved
 *
 * Booking.com:
 * - SUMMARY:CLOSED - Not available
 */

function detectIcsSource(icsUrl) {
  const url = String(icsUrl || "").toLowerCase();

  if (url.includes("booking.com") || url.includes("admin.booking")) {
    return "Booking.com";
  }

  if (url.includes("airbnb.com")) {
    return "Airbnb";
  }

  return "Unknown";
}

function unfoldIcsText(icsText) {
  return String(icsText || "").replace(/\r?\n[ \t]/g, "");
}

function extractICSDate(block, fieldName) {
  const regex = new RegExp(fieldName + "(?:;[^:]*)?:(\\d{8})");
  const match = block.match(regex);

  if (!match) return null;

  const raw = match[1];
  const year = Number(raw.substring(0, 4));
  const month = Number(raw.substring(4, 6)) - 1;
  const day = Number(raw.substring(6, 8));

  return new Date(year, month, day);
}

function extractICSField(block, fieldName) {
  const regex = new RegExp(fieldName + "(?:;[^:]*)?:(.+)", "i");
  const match = block.match(regex);

  return match ? match[1].trim() : "";
}

function formatDate(date) {
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Airbnb ICS UID 格式：<guestId>-<hash>@airbnb.com
// 取第一个 "-" 之前的部分即为 guest user ID。
function extractGuestId(uid) {
  const dashIndex = String(uid || "").indexOf("-");
  return dashIndex > 0 ? uid.substring(0, dashIndex) : null;
}

// DESCRIPTION 示例：
// "Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMA9HEMTM4\nPhone Number..."
function extractReservationCode(description) {
  const match = String(description || "").match(/\/reservations\/details\/([A-Z0-9]+)/i);
  return match ? match[1] : null;
}

function parseAirbnbICSEvents(icsText) {
  const events = [];
  const cleanText = unfoldIcsText(icsText);
  const blocks = cleanText.split("BEGIN:VEVENT");

  for (const block of blocks) {
    if (!block.includes("END:VEVENT")) continue;

    const summary = extractICSField(block, "SUMMARY");
    const uid = extractICSField(block, "UID");

    if (summary.toLowerCase() !== "reserved") continue;

    const start = extractICSDate(block, "DTSTART");
    const end = extractICSDate(block, "DTEND");

    if (!start || !end) continue;

    const description = extractICSField(block, "DESCRIPTION");
    const guestId = extractGuestId(uid);
    const reservationCode = extractReservationCode(description);

    events.push({ start, end, summary, uid, guestId, reservationCode, source: "Airbnb" });
  }

  return events;
}

function parseBookingICSEvents(icsText) {
  const events = [];
  const cleanText = unfoldIcsText(icsText);
  const blocks = cleanText.split("BEGIN:VEVENT");

  for (const block of blocks) {
    if (!block.includes("END:VEVENT")) continue;

    const summary = extractICSField(block, "SUMMARY");
    const uid = extractICSField(block, "UID");

    if (!summary.toLowerCase().includes("closed - not available")) continue;

    const start = extractICSDate(block, "DTSTART");
    const end = extractICSDate(block, "DTEND");

    if (!start || !end) continue;

    events.push({ start, end, summary, uid, source: "Booking.com" });
  }

  return events;
}

function deriveRoomStatus(events, source) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const valid = events
    .filter((e) => e.end >= today)
    .sort((a, b) => a.start - b.start);

  if (!valid.length) return { status: "Vacant", note: "" };

  const note = valid
    .map((e) => `${formatDate(e.start)} - ${formatDate(e.end)}`)
    .join("\n");

  const status =
    source === "Booking.com" ? "Booking.com Rented" :
    source === "Airbnb"      ? "Airbnb Rented"      :
                               "Rented";

  return { status, note };
}

module.exports = {
  detectIcsSource,
  parseAirbnbICSEvents,
  parseBookingICSEvents,
  deriveRoomStatus,
};
