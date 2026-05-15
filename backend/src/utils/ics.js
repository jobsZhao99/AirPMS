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
  
      events.push({
        start,
        end,
        summary,
        // UID 通常可以作为 reservation/confirmation code 的弱引用，
        // 详情页只用于生成快捷跳转，不写回主数据。
        uid,
        source: "Airbnb",
      });
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
      const summaryLower = summary.toLowerCase();
      const uid = extractICSField(block, "UID");
  
      if (!summaryLower.includes("closed - not available")) continue;
  
      const start = extractICSDate(block, "DTSTART");
      const end = extractICSDate(block, "DTEND");
  
      if (!start || !end) continue;
  
      events.push({
        start,
        end,
        summary,
        uid,
        source: "Booking.com",
      });
    }
  
    return events;
  }
  
  function parseICSEventsBySource(icsText, source) {
    if (source === "Booking.com") {
      return parseBookingICSEvents(icsText);
    }
  
    if (source === "Airbnb") {
      return parseAirbnbICSEvents(icsText);
    }
  
    return [
      ...parseAirbnbICSEvents(icsText),
      ...parseBookingICSEvents(icsText),
    ];
  }
  
  /**
   * Read one ICS URL and return status + note.
   *
   * Final status examples:
   * - Airbnb Rented
   * - Booking.com Rented
   * - Vacant
   * - HTTP 404
   * - Not ICS
   * - ICS Error
   */
  async function getRecentStayFromICS(icsUrl) {
    const source = detectIcsSource(icsUrl);
  
    const response = await fetch(icsUrl, {
      redirect: "follow",
    });
  
    if (!response.ok) {
      return {
        status: `HTTP ${response.status}`,
        note: `ICS fetch failed. HTTP Status: ${response.status}`,
      };
    }
  
    const icsText = await response.text();
  
    if (!icsText.includes("BEGIN:VCALENDAR")) {
      return {
        status: "Not ICS",
        note: "Fetched content is not valid ICS calendar content.",
      };
    }
  
    const events = parseICSEventsBySource(icsText, source);
  
    if (!events.length) {
      return {
        status: "Vacant",
        note: "",
      };
    }
  
    const today = new Date();
    today.setHours(0, 0, 0, 0);
  
    const validEvents = events
      .filter((event) => event.end >= today)
      .sort((a, b) => a.start - b.start);
  
    if (!validEvents.length) {
      return {
        status: "Vacant",
        note: "",
      };
    }
  
    const note = validEvents
      .map((event) => `${formatDate(event.start)} - ${formatDate(event.end)}`)
      .join("\n");
  
    const rentedStatus =
      source === "Booking.com"
        ? "Booking.com Rented"
        : source === "Airbnb"
          ? "Airbnb Rented"
          : "Rented";
  
    return {
      status: rentedStatus,
      note,
    };
  }
  
  module.exports = {
    getRecentStayFromICS,
    detectIcsSource,
    parseAirbnbICSEvents,
    parseBookingICSEvents,
  };
