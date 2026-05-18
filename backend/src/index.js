const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const prisma = require("./prisma");

const { syncIcsStatus } = require("./services/syncIcsStatusService");
const { syncLongTermLeases } = require("./services/syncLongTermLeasesService");
const {
  downloadAllDatabaseData,
} = require("./services/downloadDatabaseService");
const roomProfileController = require("./room-profile/RoomProfileController");

dotenv.config();

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://air-pms.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error(`CORS blocked origin: ${origin}`);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Disposition"],
    credentials: true,
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.send("AirPMS backend is running");
});

app.get("/api/rooms/:id/profile", roomProfileController.getProfile);
app.patch(
  "/api/rooms/:id/admin-notes",
  roomProfileController.updateAdminNotes
);
app.post(
  "/api/rooms/:id/listing-urls",
  roomProfileController.addListingUrl
);
app.patch(
  "/api/rooms/:id/listing-urls/:urlId",
  roomProfileController.updateListingUrl
);
app.post(
  "/api/rooms/:id/listing-urls/:urlId/set-primary",
  roomProfileController.setPrimaryUrl
);
app.delete(
  "/api/rooms/:id/listing-urls/:urlId",
  roomProfileController.deleteListingUrl
);

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

app.post("/admin/download-data", async (req, res) => {
  try {
    const { password } = req.body;

    if (password !== "admin12345") {
      return res.status(401).json({
        message: "Invalid admin password",
      });
    }

    const data = await downloadAllDatabaseData();
    const filename = `airpms-database-${data.exportedAt.slice(0, 10)}.json`;

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    res.json(data);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to download database data",
      error: error.message,
    });
  }
});

app.get("/properties", async (req, res) => {
  try {
    const properties = await prisma.property.findMany({
      include: {
        units: {
          include: {
            listingUrls: true,
          },
        },
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
            listingUrls: true,
            rooms: {
              include: {
                listingUrls: true,
              },
            },
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
      error: error.message,
    });
  }
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

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 3000;
const ENABLE_AUTO_SYNC = process.env.ENABLE_AUTO_SYNC === "true";

app.listen(PORT, () => {
  console.log(`AirPMS server running on port ${PORT}`);

  if (ENABLE_AUTO_SYNC) {
    console.log("Auto sync enabled");

    runAutoSync();
    setInterval(runAutoSync, 30 * 60 * 1000);
  } else {
    console.log("Auto sync disabled");
  }
});
