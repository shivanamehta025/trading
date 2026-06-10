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

app.post("/api/pending-challan", async (req, res) => {
  try {

    const { databaseName, branchId } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool.request()
      .input("what", sql.VarChar, "pending_challan")
      .input("branch", sql.VarChar, branchId)
      .execute("A_SP_FOR_SRL_APP");

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

app.post("/api/pending-srl", async (req, res) => {
  try {

    const { databaseName, branchId } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool.request()
      .input("what", sql.VarChar, "PENDING_SRL")
      .input("branch", sql.VarChar, branchId)
      .execute("A_SP_FOR_SRL_APP");

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

const sendNotification =
require("./services/firebaseNotification");

app.post("/api/srl-approval", async (req, res) => {

  try {

    const {
      databaseName,
      userId,
      system,
      srlUnq
    } = req.body;

    const pool =
      await getPool(databaseName);

    const result =
      await pool.request()

      .input("what", sql.VarChar, "SRLapproval")

      .input("SM1016_28", sql.VarChar, userId)

      .input("LISTOFUNQID", sql.VarChar, srlUnq)

      .execute("A_SP_FOR_SRL_APP");


    // ===============================
    // SEND NOTIFICATION HERE
    // ===============================

    const cmpyPool =
      await getPool();


      const srlResult = await pool.request()
  .input("srlUnq", sql.VarChar, srlUnq)
  .query(`
      SELECT sm1016_c3 AS USERID
      FROM sm1016_c
      WHERE unqid = @srlUnq
  `);

const targetUserId = srlResult.recordset[0]?.USERID;

console.log("Target User ID:", targetUserId);
console.log("Sending notification to User:", targetUserId);
    const tokenResult =
      await cmpyPool.request()
 .input("userId", sql.VarChar, targetUserId)
      .query(`
        SELECT DEVICETOKEN
        FROM APP_DEVICE_TOKEN
        WHERE USERID=@userId
      `);

    if (
      tokenResult.recordset.length > 0
    ) {

      const token =
        tokenResult.recordset[0]
          .DEVICETOKEN;

      await sendNotification(

        token,

        "SRL Approved",

        "Your SRL has been approved."
      );
    }

    // ===============================

    res.json({
      success: true,
      data: result.recordset
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

app.post("/api/srl-reject", async (req, res) => {

  try {

    const {
      databaseName,
      userId,
      system,
      srlUnq
    } = req.body;

    const pool =
      await getPool(databaseName);
console.log("userId =", userId);
    const result =
      await pool.request()

      .input(
        "what",
        sql.VarChar,
        "SRLreject"
      )

      .input(
        "SM1016_28",
        sql.VarChar,
        userId
      )

     

      .input(
        "LISTOFUNQID",
        sql.VarChar,
        srlUnq
      )

      .execute("A_SP_FOR_SRL_APP");

    res.json({
      success: true,
      data: result.recordset
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

app.post("/api/challan-approval", async (req, res) => {

  try {

    const {
      databaseName,
      userId,
      challanUnq
    } = req.body;

    const pool =
      await getPool(databaseName);

    const result =
      await pool.request()

      .input(
        "what",
        sql.VarChar,
        "challanApproval"
      )

      .input(
        "SM1008_32",
        sql.VarChar,
        userId
      )

      .input(
        "LISTOFUNQID",
        sql.VarChar,
        challanUnq
      )

      .execute("A_SP_FOR_SRL_APP");

    res.json({
      success: true,
      data: result.recordset
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});


app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "API Updated"
  });
});



app.post("/api/save-device-token", async (req, res) => {

  try {
    console.log("BODY RECEIVED");
console.log(req.body);

    const {
  userId,
  userName,
  token
} = req.body;

    if (!userId || !userName || !token) {

      return res.status(400).json({
        success: false,
        message: "UserId and Token are required"
      });
    }

    const pool = await getPool();

    await pool.request()

      .input(
        "userId",
        sql.VarChar,
        userId
      )

      .input(
        "token",
        sql.NVarChar(sql.MAX),
        token
      )
      .input(
  "userName",
  sql.VarChar,
  userName
)

     .query(`

    IF EXISTS
    (
        SELECT *
        FROM APP_DEVICE_TOKEN
        WHERE USERID = @userId
    )
    BEGIN

      UPDATE APP_DEVICE_TOKEN
SET
    USERNAME = @userName,
    DEVICETOKEN = @token,
    LASTLOGIN = GETDATE()
WHERE USERID = @userId

    END
    ELSE
    BEGIN
INSERT INTO APP_DEVICE_TOKEN
(
    USERID,
    USERNAME,
    DEVICETOKEN,
    LASTLOGIN
)
VALUES
(
    @userId,
    @userName,
    @token,
    GETDATE()
)
    END

`);

    console.log(
      `✅ Token Saved for ${userId}`
    );

    res.json({
      success: true,
      message: "Token saved successfully"
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

app.post("/api/get-count", async (req, res) => {
  try {

    const { databaseName } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool.request()
      .input("what", sql.VarChar, "GET_COUNT")
      .execute("A_SP_FOR_SRL_APP");

    res.json({
      success: true,
      data: result.recordset
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
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
