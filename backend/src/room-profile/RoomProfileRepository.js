const prisma = require("../prisma");

async function getRoomById(roomId) {
  return prisma.room.findUnique({
    where: { id: roomId },
    include: {
      listingUrls: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      unit: {
        include: { property: true },
      },
    },
  });
}

async function updateAdminNotes(roomId, adminNotes) {
  return prisma.room.update({
    where: { id: roomId },
    data: { adminNotes },
  });
}

async function createListingUrl(data) {
  return prisma.listingUrl.create({ data });
}

async function getListingUrlById(urlId) {
  return prisma.listingUrl.findUnique({ where: { id: urlId } });
}

async function updateListingUrl(urlId, data) {
  return prisma.listingUrl.update({ where: { id: urlId }, data });
}

async function setPrimaryUrl(roomId, urlId) {
  await prisma.listingUrl.updateMany({
    where: { roomId, isPrimary: true },
    data: { isPrimary: false },
  });
  return prisma.listingUrl.update({
    where: { id: urlId },
    data: { isPrimary: true },
  });
}

async function deactivateListingUrl(urlId) {
  return prisma.listingUrl.update({
    where: { id: urlId },
    data: { status: "inactive", isPrimary: false },
  });
}

module.exports = {
  getRoomById,
  updateAdminNotes,
  createListingUrl,
  getListingUrlById,
  updateListingUrl,
  setPrimaryUrl,
  deactivateListingUrl,
};
