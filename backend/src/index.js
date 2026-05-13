const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { syncIcsStatus } = require("./services/syncIcsStatusService");
const { syncLongTermLeases } = require("./services/syncLongTermLeasesService");

const pg = require("pg");

dotenv.config();

const app = express();

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

const allowedOrigins = [
  "http://localhost:5173",
  "https://air-pms.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      /**
       * Allow:
       * - Postman
       * - curl
       * - server-to-server requests
       */
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error(`CORS blocked origin: ${origin}`);

      return callback(
        new Error(`CORS blocked for origin: ${origin}`)
      );
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],

    credentials: true,
  })
);

/**
 * Handle browser preflight requests
 */
// app.options("*", cors());

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
| Health Check
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.send("AirPMS backend is running");
});




/*
|--------------------------------------------------------------------------
| sync-ics
|--------------------------------------------------------------------------
*/


app.post("/admin/sync-ics", async (req, res) => {
  try {
    const { password } = req.body;

    if (password !== "admin12345") {
      return res.status(401).json({
        message: "Invalid admin password",
      });
    }

    const result = await syncIcsStatus();

    res.json({
      message: "ICS sync completed",
      result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "ICS sync failed",
      error: error.message,
    });
  }
});



app.post("/admin/sync-longterm", async (req, res) => {
  try {
    const { password } = req.body;

    if (password !== "admin12345") {
      return res.status(401).json({
        message: "Invalid admin password",
      });
    }

    const result = await syncLongTermLeases();

    res.json({
      message: "Long Term sync completed",
      result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Long Term sync failed",
      error: error.message,
    });
  }
});


/*
|--------------------------------------------------------------------------
| Properties
|--------------------------------------------------------------------------
*/

app.get("/properties", async (req, res) => {
  try {
    const properties = await prisma.property.findMany({
      include: {
        units: true,
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

/*
|--------------------------------------------------------------------------
| Dashboard Inventory
|--------------------------------------------------------------------------
*/

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
| Global Error Handler
|--------------------------------------------------------------------------
*/

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: err.message || "Internal Server Error",
  });
});





let autoSyncRunning = false;

async function runAutoSync() {
  if (autoSyncRunning) {
    console.log("Auto sync skipped: previous sync still running");
    return;
  }

  autoSyncRunning = true;

  try {
    console.log("Auto sync started");

    const icsResult = await syncIcsStatus();
    console.log("Auto ICS sync completed:", icsResult);

    const longTermResult = await syncLongTermLeases();
    console.log("Auto Long Term sync completed:", longTermResult);

    console.log("Auto sync completed");
  } catch (error) {
    console.error("Auto sync failed:", error);
  } finally {
    autoSyncRunning = false;
  }
}




/*
|--------------------------------------------------------------------------
| Server
|--------------------------------------------------------------------------
*/

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`AirPMS server running on port ${PORT}`);

  // 启动后先跑一次
  runAutoSync();

  // 每 30 分钟跑一次
  setInterval(runAutoSync, 30 * 60 * 1000);
});