const prisma = require("../src/prisma");
const { syncIcsStatus } = require("../src/services/syncIcsStatusService");

async function main() {
  console.log("Starting ICS sync...");

  const result = await syncIcsStatus();

  console.log("\n========== ICS SYNC SUMMARY ==========");
  console.log(result);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("ICS sync failed:");
  console.error(error);

  await prisma.$disconnect();
  process.exit(1);
});