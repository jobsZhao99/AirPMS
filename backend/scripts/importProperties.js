const fs = require("fs");
const path = require("path");
const prisma = require("../src/prisma");

/**
 * Normalize and clean Property name.
 *
 * Why this is important:
 * - Remove BOM characters from CSV exports
 * - Remove hidden \r \n \t characters
 * - Normalize multiple spaces
 * - Prevent duplicate Property names caused by formatting issues
 */
function cleanPropertyName(value) {
  if (!value) return "";

  return String(value)
    .replace(/^\uFEFF/, "")        // Remove UTF-8 BOM
    .replace(/[\r\n\t]/g, " ")     // Remove hidden line breaks / tabs
    .replace(/[“”]/g, '"')         // Normalize Chinese double quotes
    .replace(/[‘’]/g, "'")         // Normalize Chinese single quotes
    .replace(/\s+/g, " ")          // Collapse multiple spaces
    .trim();                       // Remove leading/trailing spaces
}

async function importProperties() {
  try {
    const filePath = path.join(
      __dirname,
      "../data/ImportData - Property.csv"
    );

    /**
     * Read CSV/TXT file as plain text.
     * File format expected:
     *
     * USC - TL 1431 W 37th St
     * USC - TL 1455 W 36th St
     * USC - TL 1476 W 35th St
     */
    const content = fs.readFileSync(filePath, "utf-8");

    /**
     * Split by lines and clean every Property name.
     */
    const propertyNames = content
      .split(/\r?\n/)
      .map(cleanPropertyName)
      .filter(Boolean);

    console.log(`Found ${propertyNames.length} properties`);

    let importedCount = 0;
    let skippedCount = 0;

    for (const rawName of propertyNames) {
      const name = cleanPropertyName(rawName);

      if (!name) {
        skippedCount++;
        continue;
      }

      /**
       * Check whether Property already exists.
       */
      const existing = await prisma.property.findFirst({
        where: {
          name,
        },
      });

      if (existing) {
        console.log(`Skipped existing: ${name}`);
        skippedCount++;
        continue;
      }

      /**
       * Create new Property.
       */
      await prisma.property.create({
        data: {
          name,
        },
      });

      console.log(`Imported: ${name}`);
      importedCount++;
    }

    console.log("\n========== IMPORT SUMMARY ==========");
    console.log(`Imported: ${importedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log("Property import completed");

    await prisma.$disconnect();

  } catch (error) {
    console.error("\n========== IMPORT FAILED ==========");
    console.error(error);

    await prisma.$disconnect();

    process.exit(1);
  }
}

importProperties();