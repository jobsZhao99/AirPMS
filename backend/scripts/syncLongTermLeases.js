const prisma = require("../src/prisma");
const { syncLongTermLeases } = require("../src/services/syncLongTermLeasesService");

async function main() {
  console.log("Starting Long Term sync...");

  const result = await syncLongTermLeases();

  console.log("\n========== LONG TERM SYNC SUMMARY ==========");
  console.log(result);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("Long Term sync failed:");
  console.error(error);

  await prisma.$disconnect();
  process.exit(1);
});