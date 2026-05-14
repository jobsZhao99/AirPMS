const prisma = require("../src/prisma");

function extractAirbnbListingId(url) {
  const value = String(url || "").trim();
  const match = value.match(/\/(\d+)\.ics(?:[?#].*)?$/i);

  return match ? match[1] : null;
}

async function extractAirbnbListingIds() {
  const listings = await prisma.listingUrl.findMany({
    where: {
      OR: [
        {
          channel: {
            equals: "Airbnb",
            mode: "insensitive",
          },
        },
        {
          url: {
            contains: "airbnb.com",
            mode: "insensitive",
          },
        },
      ],
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  let updated = 0;
  let alreadySet = 0;
  let skipped = 0;

  for (const listing of listings) {
    const listingId = extractAirbnbListingId(listing.url);

    if (!listingId) {
      console.log(`Skipped: no Airbnb listing id found -> ${listing.url}`);
      skipped++;
      continue;
    }

    if (listing.listingId === listingId) {
      alreadySet++;
      continue;
    }

    await prisma.listingUrl.update({
      where: {
        id: listing.id,
      },
      data: {
        listingId,
      },
    });

    console.log(`Updated ListingUrl ${listing.id}: ${listingId}`);
    updated++;
  }

  return {
    airbnbListingsFound: listings.length,
    updated,
    alreadySet,
    skipped,
  };
}

extractAirbnbListingIds()
  .then(async (result) => {
    console.log("\n========== AIRBNB LISTING ID SUMMARY ==========");
    console.log(`Airbnb listings found: ${result.airbnbListingsFound}`);
    console.log(`Updated: ${result.updated}`);
    console.log(`Already set: ${result.alreadySet}`);
    console.log(`Skipped: ${result.skipped}`);

    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Airbnb listing id extraction failed:");
    console.error(error);

    await prisma.$disconnect();
    process.exit(1);
  });
