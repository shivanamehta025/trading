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

const srlResult = await pool.request()
  .input("srlUnq", sql.VarChar, srlUnq)
  .query(`
      SELECT 
          sm1016_c3 AS USERID,
          sm1016_5 AS ORDERNO
      FROM sm1016_c
      INNER JOIN SM1016
          ON SM1016.UNQID = SM1016_C.SM1016_C5
      WHERE sm1016_c.UNQID = @srlUnq
  `);

const targetUserId =
  srlResult.recordset[0]?.USERID;

const orderNo =
  srlResult.recordset[0]?.ORDERNO;

const message =
  `Your order no. ${orderNo} has been approved.`;

console.log(
  "Target User ID:",
  targetUserId
);

console.log(
  "Order No:",
  orderNo
);

// =====================================
// SAVE NOTIFICATION IN DATABASE
// =====================================

if (targetUserId) {

   await pool.request()

    .input(
      "USERID",
      sql.VarChar,
      targetUserId
    )

    .input(
      "TITLE",
      sql.VarChar,
      "SRL Approved"
    )

    .input(
      "MESSAGE",
      sql.NVarChar,
      message
    )

    .input(
      "REFERENCEID",
      sql.VarChar,
      srlUnq
    )

    .input("DATABASENAME", sql.VarChar, databaseName)

    .query(`
      INSERT INTO APP_NOTIFICATION
      (
        USERID,
        TITLE,
        MESSAGE,
        REFERENCEID,
        DATABASENAME
      )
      VALUES
      (
        @USERID,
        @TITLE,
        @MESSAGE,
        @REFERENCEID,
        @DATABASENAME
      )
    `);
}

// =====================================
// SEND PUSH NOTIFICATION (FCM)
// =====================================

 const companyPool =
      await getPool();

    const tokenResult =
      await companyPool.request()
    .input(
      "userId",
      sql.VarChar,
      targetUserId
    )

    .query(`
      SELECT DEVICETOKEN
      FROM APP_DEVICE_TOKEN
      WHERE USERID = @userId
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
    message
  );
}

// ===============================

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

app.post("/api/notifications", async (req, res) => {

  try {

    const {
      userId,
      allowedDatabases
    } = req.body;

    let allNotifications = [];

    const dbs =
      allowedDatabases.split(",");

    for (const db of dbs) {

      let databaseName = "";

      if (db.trim() === "TRADING") {
        databaseName = "Testing";
      }

      if (db.trim() === "NT") {
        databaseName =
          "ac25";
      }

      if (!databaseName) continue;

      const pool =
        await getPool(databaseName);

      const result =
        await pool.request()

          .input(
            "userId",
            sql.VarChar,
            userId
          )

          .query(`
            SELECT
              ID,
              TITLE,
              MESSAGE,
              CREATEDON,
             DATABASENAME
            FROM APP_NOTIFICATION
            WHERE USERID=@userId
          `);

      allNotifications.push(
        ...result.recordset
      );
    }

    allNotifications.sort(
      (a, b) =>
        new Date(b.CREATEDON) -
        new Date(a.CREATEDON)
    );

    res.json({
      success: true,
      data: allNotifications
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

app.post("/api/read-notification", async (req, res) => {

  try {

    const {
      id,
      databaseName
    } = req.body;

    const pool =
      await getPool(databaseName);

    await pool.request()

      .input(
        "id",
        sql.Int,
        id
      )

      .query(`
        UPDATE APP_NOTIFICATION
        SET ISREAD = 1
        WHERE ID = @id
      `);

    res.json({
      success: true
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});
app.post("/api/notification-count", async (req, res) => {

  try {

   const dbMap = {
  TRADING: "Testing",
  NT: "ac25"
};

const databases = allowedDatabases.split(",");

for (const db of databases) {

  const actualDb =
      dbMap[db.trim().toUpperCase()];

  if (!actualDb) continue;

  const pool =
      await getPool(actualDb);

  const result =
      await pool.request()
      .input("userId", sql.VarChar, userId)
      .query(`
        SELECT COUNT(*) AS CNT
        FROM APP_NOTIFICATION
        WHERE USERID=@userId
        AND ISREAD=0
      `);

  totalCount +=
      result.recordset[0].CNT;
}

  } catch (err) {

  console.log("NOTIFICATION COUNT ERROR");
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
