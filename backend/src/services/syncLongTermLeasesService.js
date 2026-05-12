const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const prisma = require("../prisma");

const FILE_PATH = path.join(
  __dirname,
  "../../data/Jobs' airbnb_ops_v9_1_reviewed_complete_template - Tenant Directory.csv"
);

const LONG_TERM_MARKER = "LT:";

// 把你原来的 clean / normalizeUnitKey / shouldSkipTenant /
// isShortTermRentedStatus / formatDate / mergeNotes / findHeaderRow /
// getColIndex / buildTenantNote 全部复制到这里

async function syncLongTermLeases() {
  // 这里放你原来的 syncLongTermLeases 函数内容
  // 最后不要 prisma.$disconnect()

  return {
    updatedLongTerm,
    mergedWithShortTerm,
    noMatch,
  };
}

module.exports = {
  syncLongTermLeases,
};