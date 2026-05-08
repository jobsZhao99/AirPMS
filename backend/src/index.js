const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const { PrismaClient } = require("@prisma/client");

const { PrismaPg } = require("@prisma/adapter-pg");

const pg = require("pg");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

/*
|--------------------------------------------------------------------------
| PostgreSQL Pool
|--------------------------------------------------------------------------
*/

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  /*
  |--------------------------------------------------------------------------
  | Prisma Adapter
  |--------------------------------------------------------------------------
  */
  
  const adapter = new PrismaPg(pool);
  
  /*
  |--------------------------------------------------------------------------
  | Prisma Client
  |--------------------------------------------------------------------------
  */
  
  const prisma = new PrismaClient({
    adapter,
  });
  
  /*
  |--------------------------------------------------------------------------
  | Routes
  |--------------------------------------------------------------------------
  */

app.get("/", (req, res) => {
  res.send("AirPMS backend is running");
});

app.get("/properties", async (req, res) => {
    try {
      const properties = await prisma.property.findMany({
        include: {
          units: true,
          rooms: true,
        },
      });
  
      res.json(properties);
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: "Failed to fetch properties",
      });
    }
  });
  
  app.post("/properties", async (req, res) => {
    try {
      const { name, address } = req.body;
  
      const property = await prisma.property.create({
        data: {
          name,
          address,
        },
      });
  
      res.json(property);
    } catch (err) {
      console.error(err);
  
      res.status(500).json({
        error: "Failed to create property",
      });
    }
  });
  
  app.get("/dashboard/inventory", async (req, res) => {
    try {
      const properties = await prisma.property.findMany({
        include: {
          units: {
            include: {
              rooms: true,
            },
            orderBy: {
              name: "asc",
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      });
  
      res.json(properties);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Failed to load inventory dashboard",
      });
    }
  });


  /*
  |--------------------------------------------------------------------------
  | Server
  |--------------------------------------------------------------------------
  */
  
  const PORT = process.env.PORT || 3000;
  
  app.listen(PORT, () => {
    console.log(`AirPMS server running on http://localhost:${PORT}`);
  });