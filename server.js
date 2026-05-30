const express = require("express");
const cors = require("cors");
const https = require("https");
const http_mod = require("http");
const sql = require("mssql");

require("dotenv").config();

const { getPool } = require("./config/db");
const initDb = require("./config/initDb");


const app = express();

// ── MIDDLEWARE ───────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));




// ── HEALTH CHECK ─────────────────────────────────────
app.get("/", (_, res) => {
  res.json({
    status: "ok",
    db: "SQL Server",
    time: Date.now(),
  });
});

app.get("/ping", (_, res) => {
  res.json({
    pong: true,
  });
});


app.post('/api/login', async (req, res) => {

    try {

        const { userId, password } = req.body;

        const pool = await getPool();

        const result = await pool.request()

            .input('userId', sql.VarChar, userId)
            .input('password', sql.VarChar, password)

            .query(`
                SELECT *
                FROM SM63
                WHERE SM63_5 = @userId
                AND SM63_7 = @password
            `);

        if (result.recordset.length > 0) {

            return res.json({

                success: true,

                user: result.recordset[0]
            });
        }

        return res.status(401).json({

            success: false,

            message: 'Invalid UserID or Password'
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,
            message: err.message
        });
    }
});

app.post("/api/branches", async (req, res) => {
  try {

    const { databaseName } = req.body;

    console.log("DATABASE =", databaseName);

    const pool = await getPool(databaseName);

    const result = await pool.request().query(`
      SELECT
        SM1002_5 AS unqid,
        SM1002_7 AS Branch
      FROM SM1002
      ORDER BY SM1002_7
    `);

    console.log(result.recordset);

    res.json({
      success: true,
      data: result.recordset,
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "API Updated"
  });
});



// ─────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

(async () => {
  try {
    // ── DEFAULT DB CONNECTION ────────────────────
    await getPool();

    console.log("✅ SQL Server Connected");

    // ── INIT DB ──────────────────────────────────
    await initDb();

    // ── START SERVER ─────────────────────────────
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // ── SELF PING ────────────────────────────────
    const RENDER_URL = process.env.RENDER_URL || `http://localhost:${PORT}`;

    setInterval(
      () => {
        const url = new URL(RENDER_URL + "/ping");

        const mod = url.protocol === "https:" ? https : http_mod;

        const req = mod.get(url.toString(), (res) => {
          console.log(`🏓 Self-ping: ${res.statusCode}`);
        });

        req.on("error", (e) => {
          console.log("Ping error:", e.message);
        });

        req.end();
      },
      14 * 60 * 1000,
    );
  } catch (err) {
    console.error("❌ Failed to connect to SQL Server:", err.message);

    process.exit(1);
  }
})();
