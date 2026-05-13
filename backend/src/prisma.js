const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

require("dotenv").config();

const isRenderOrProduction =
  process.env.RENDER === "true" ||
  process.env.NODE_ENV === "production" ||
  process.env.DATABASE_URL?.includes("render.com");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Render PostgreSQL / remote Postgres 需要 SSL
  // 本地 PostgreSQL 不需要
  ssl: isRenderOrProduction
    ? {
        rejectUnauthorized: false,
      }
    : false,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

module.exports = prisma;