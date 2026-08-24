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

app.post("/api/login", async (req, res) => {
  try {
    const { userId, password } = req.body;

    const pool = await getPool();

    const result = await pool
      .request()
      .input("userId", sql.VarChar, userId)
      .input("password", sql.VarChar, password).query(`
                SELECT *
                FROM SM63
                INNER JOIN SM61
                    ON SM61.UNQID = SM63_8
                WHERE SM63_5 = @userId
                  AND SM63_7 = @password
            `);

    if (result.recordset.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid UserID or Password",
      });
    }

    // First row contains common user information
    const firstRow = result.recordset[0];

    // Build company list
    const companies = result.recordset.map((row) => ({
      companyCode: row.SM63_14,
      databaseName: row.SM63_15,
    }));

    return res.json({
      success: true,

      user: {
        sm63_5: firstRow.sm63_5,
        sm63_6: firstRow.sm63_6,
        sm61_6: firstRow.sm61_6,
        sm61_9: firstRow.sm61_9,
      },

      companies: companies,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});
app.post("/api/user-level", async (req, res) => {
  try {
    const { databaseName, userId } = req.body;

    console.log("========== USER LEVEL ==========");
    console.log("databaseName =", databaseName);
    console.log("userId =", userId);

    if (!databaseName || !userId) {
      return res.status(400).json({
        success: false,
        message: "databaseName and userId are required",
      });
    }

    const pool = await getPool(databaseName);

    const result = await pool.request().input("userId", sql.VarChar, userId)
      .query(`
        SELECT TOP 1
          s63.SM63_5 AS UserID,
          s63.SM63_6 AS UserName,
          s61.SM61_6 AS Designation,
          s61.SM61_9 AS Level
        FROM SM63 AS s63
        INNER JOIN SM61 AS s61
          ON s61.UNQID = s63.SM63_8
        WHERE s63.SM63_5 = @userId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User level not found",
      });
    }

    const user = result.recordset[0];

    console.log("LEVEL FOUND =", user.Level);
    console.log("DESIGNATION =", user.Designation);

    return res.json({
      success: true,
      level: user.Level,
      designation: user.Designation,
    });
  } catch (err) {
    console.log("USER LEVEL ERROR =", err);

    return res.status(500).json({
      success: false,
      message: err.message,
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

    const result = await pool
      .request()
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

    const result = await pool
      .request()
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

const sendNotification = require("./services/firebaseNotification");

app.post("/api/srl-approval", async (req, res) => {
  try {
    const { databaseName, userId, system, srlUnq } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool
      .request()

      .input("what", sql.VarChar, "SRLapproval")

      .input("SM1016_28", sql.VarChar, userId)

      .input("LISTOFUNQID", sql.VarChar, srlUnq)

      .execute("A_SP_FOR_SRL_APP");

    // ===============================
    // SEND NOTIFICATION HERE
    // ===============================

    const srlResult = await pool.request().input("srlUnq", sql.VarChar, srlUnq)
      .query(`
      SELECT 
          sm1016_c3 AS USERID,
          sm1016_5 AS ORDERNO
      FROM sm1016_c
      INNER JOIN SM1016
          ON SM1016.UNQID = SM1016_C.SM1016_C5
      WHERE sm1016_c.UNQID = @srlUnq
  `);

    const targetUserId = srlResult.recordset[0]?.USERID;

    const orderNo = srlResult.recordset[0]?.ORDERNO;

    const message = `Your order no. ${orderNo} has been approved.`;

    console.log("Target User ID:", targetUserId);

    console.log("Order No:", orderNo);

    // =====================================
    // SAVE NOTIFICATION IN DATABASE
    // =====================================

    if (targetUserId) {
      await pool
        .request()

        .input("USERID", sql.VarChar, targetUserId)

        .input("TITLE", sql.VarChar, "SRL Approved")

        .input("MESSAGE", sql.NVarChar, message)

        .input("REFERENCEID", sql.VarChar, srlUnq)

        .input("DATABASENAME", sql.VarChar, databaseName).query(`
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

    const companyPool = await getPool();

    const tokenResult = await companyPool
      .request()
      .input("userId", sql.VarChar, targetUserId).query(`
      SELECT DEVICETOKEN
      FROM APP_DEVICE_TOKEN
      WHERE USERID = @userId
    `);

    if (tokenResult.recordset.length > 0) {
      const token = tokenResult.recordset[0].DEVICETOKEN;

      await sendNotification(token, "SRL Approved", message);
    }

    // ===============================

    // ===============================

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

app.post("/api/srl-reject", async (req, res) => {
  try {
    const { databaseName, userId, system, srlUnq } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool
      .request()

      .input("what", sql.VarChar, "SRLreject")

      .input("SM1016_28", sql.VarChar, userId)

      .input("LISTOFUNQID", sql.VarChar, srlUnq)

      .execute("A_SP_FOR_SRL_APP");

    // ===============================
    // SEND NOTIFICATION HERE
    // ===============================

    const srlResult = await pool.request().input("srlUnq", sql.VarChar, srlUnq)
      .query(`
      SELECT 
          sm1016_c3 AS USERID,
          sm1016_5 AS ORDERNO
      FROM sm1016_c
      INNER JOIN SM1016
          ON SM1016.UNQID = SM1016_C.SM1016_C5
      WHERE sm1016_c.UNQID = @srlUnq
  `);

    const targetUserId = srlResult.recordset[0]?.USERID;

    const orderNo = srlResult.recordset[0]?.ORDERNO;

    const message = `Your order no. ${orderNo} has been Rejected.`;

    console.log("Target User ID:", targetUserId);

    console.log("Order No:", orderNo);

    // =====================================
    // SAVE NOTIFICATION IN DATABASE
    // =====================================

    if (targetUserId) {
      await pool
        .request()

        .input("USERID", sql.VarChar, targetUserId)

        .input("TITLE", sql.VarChar, "SRL Rejected")

        .input("MESSAGE", sql.NVarChar, message)

        .input("REFERENCEID", sql.VarChar, srlUnq)

        .input("DATABASENAME", sql.VarChar, databaseName).query(`
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

    const companyPool = await getPool();

    const tokenResult = await companyPool
      .request()
      .input("userId", sql.VarChar, targetUserId).query(`
      SELECT DEVICETOKEN
      FROM APP_DEVICE_TOKEN
      WHERE USERID = @userId
    `);

    if (tokenResult.recordset.length > 0) {
      const token = tokenResult.recordset[0].DEVICETOKEN;

      await sendNotification(token, "SRL Rejected", message);
    }

    // ===============================

    // ===============================
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

app.post("/api/challan-approval", async (req, res) => {
  try {
    const { databaseName, userId, challanUnq } = req.body;

    const pool = await getPool(databaseName);

    const companyPool = await getPool();

    // =====================================
    // CHALLAN APPROVAL
    // =====================================

    const result = await pool
      .request()

      .input("what", sql.VarChar, "challanApproval")

      .input("SM1008_32", sql.VarChar, userId)

      .input("LISTOFUNQID", sql.VarChar, challanUnq)

      .execute("A_SP_FOR_SRL_APP");

    // =====================================
    // NOTIFY CHALLAN CREATOR
    // =====================================

    const challanResult = await pool
      .request()

      .input("challanUnq", sql.VarChar, challanUnq).query(`
        SELECT
            sm1008_3 AS USERID,
            sm1008_15 AS ChallanNO
        FROM sm1008
        WHERE UNQID = @challanUnq
      `);

    const targetUserId = challanResult.recordset[0]?.USERID;

    const challanNo = challanResult.recordset[0]?.ChallanNO;

    const approvalMessage = `Your Challan No. ${challanNo} has been approved.`;

    if (targetUserId) {
      await pool
        .request()

        .input("USERID", sql.VarChar, targetUserId)

        .input("TITLE", sql.VarChar, "Challan Approved")

        .input("MESSAGE", sql.NVarChar, approvalMessage)

        .input("REFERENCEID", sql.VarChar, challanUnq)

        .input("DATABASENAME", sql.VarChar, databaseName).query(`
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

      const tokenResult = await companyPool
        .request()

        .input("userId", sql.VarChar, targetUserId).query(`
          SELECT DEVICETOKEN
          FROM APP_DEVICE_TOKEN
          WHERE USERID=@userId
        `);

      if (tokenResult.recordset.length > 0) {
        await sendNotification(
          tokenResult.recordset[0].DEVICETOKEN,
          "Challan Approved",
          approvalMessage,
        );
      }
    }

    // =====================================
    // CHALLAN LOSS / PRICE DROP ALERT
    // =====================================

    // =====================================
    // CHALLAN LOSS / PRICE DROP ALERT
    // =====================================

    console.log("START LOSS CHECK");
    console.log("challanUnq =", challanUnq);

    const lossData = await pool
      .request()

      .input("what", sql.VarChar, "challanA")

      .input("LISTOFUNQID", sql.VarChar, challanUnq)

      .execute("A_SP_FOR_SRL_APP");

    console.log("LOSS SP EXECUTED");

    console.log("Recordset Count =", lossData.recordsets.length);

    lossData.recordsets.forEach((rs, index) => {
      console.log(`TABLE ${index}`);

      console.log(rs);
    });

    console.log("TABLE 2 ROWS =", lossData.recordsets[2]?.length);

    console.log("TABLE 3 ROWS =", lossData.recordsets[3]?.length);

    const userTable = lossData.recordsets[2];

    const dataTable = lossData.recordsets[3];

    const LchallanNo = lossData.recordsets[0]?.[0]?.challanno || "";

    if (
      userTable &&
      userTable.length > 0 &&
      dataTable &&
      dataTable.length > 0
    ) {
      const row = dataTable[0];
      console.log("LOSS DATA ROW");
      console.log(row);

      const sellingRate = parseFloat(row.SELLINGRATE || 0);

      const purchaseCost = parseFloat(row.purchasecost || 0);

      const lastSellingRate = parseFloat(row.LastSellingRate_c || 0);

      let alertTitle = "";
      let alertMessage = "";

      // LOSS ALERT
      console.log("SELLINGRATE =", row.SELLINGRATE);

      console.log("PURCHASECOST =", row.purchasecost);

      console.log("LastSellingRate =", row.LastSellingRate_c);

      if (sellingRate < purchaseCost) {
        alertTitle = "Challan Loss Alert";

        alertMessage = `Challan No: ${LchallanNo}
Branch: ${row.sm1002_7}
Customer: ${row.custname}
Product: ${row.sm206_7}

Purchase Cost: ₹${row.purchasecost}
Selling Rate: ₹${row.SELLINGRATE}
Last Selling Rate: ₹${row.LastSellingRate_c}

Selling Qty: ${row.Qty} KG
Last Profit %: ${row.LastProfitPercent}%
Total Loss: ₹${row.LossAmount}

Please review and take necessary action.`;
      }

      // PRICE DROP ALERT
      else if (sellingRate < lastSellingRate) {
        alertTitle = "Price Drop Alert";

        alertMessage = `Challan No: ${LchallanNo}
Branch: ${row.sm1002_7}
Customer: ${row.custname}
Product: ${row.sm206_7}

Purchase Cost: ₹${row.purchasecost}
Last Selling Rate: ₹${row.LastSellingRate_c}
Current Selling Rate: ₹${row.SELLINGRATE}

Difference: ₹${(lastSellingRate - sellingRate).toFixed(2)}

Selling Qty: ${row.Qty} KG
Last Profit %: ${row.LastProfitPercent}%
Current Profit %: ${row.CurrentProfitPercent}%

Please review the pricing decision.`;
      }

      if (alertTitle !== "") {
        const usersString = userTable[0]?.USERS || "";

        const users = usersString
          .split(",")
          .map((x) => x.trim())
          .filter((x) => x);

        for (const targetUser of users) {
          // SAVE NOTIFICATION

          await pool
            .request()

            .input("USERID", sql.VarChar, targetUser)

            .input("TITLE", sql.VarChar, alertTitle)

            .input("MESSAGE", sql.NVarChar, alertMessage)

            .input("REFERENCEID", sql.VarChar, challanUnq)

            .input("DATABASENAME", sql.VarChar, databaseName).query(`
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

          // PUSH NOTIFICATION

          const tokenResult = await companyPool
            .request()

            .input("userId", sql.VarChar, targetUser).query(`
              SELECT DEVICETOKEN
              FROM APP_DEVICE_TOKEN
              WHERE USERID=@userId
            `);

          if (tokenResult.recordset.length > 0) {
            await sendNotification(
              tokenResult.recordset[0].DEVICETOKEN,
              alertTitle,
              alertMessage,
            );
          }
        }
      }
    }

    // =====================================

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
    message: "API Updated",
  });
});

app.post("/api/save-device-token", async (req, res) => {
  try {
    console.log("BODY RECEIVED");
    console.log(req.body);

    const { userId, userName, token } = req.body;

    if (!userId || !userName || !token) {
      return res.status(400).json({
        success: false,
        message: "UserId and Token are required",
      });
    }

    const pool = await getPool();

    await pool
      .request()

      .input("userId", sql.VarChar, userId)

      .input("token", sql.NVarChar(sql.MAX), token)
      .input("userName", sql.VarChar, userName).query(`

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

    console.log(`✅ Token Saved for ${userId}`);

    res.json({
      success: true,
      message: "Token saved successfully",
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.post("/api/get-count", async (req, res) => {
  try {
    const { databaseName } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool
      .request()
      .input("what", sql.VarChar, "GET_COUNT")
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

app.post("/api/notifications", async (req, res) => {
  try {
    const { userId, companies } = req.body;

    let allNotifications = [];

    for (const company of companies) {
      const databaseName = company.databaseName;

      if (!databaseName) continue;

      const pool = await getPool(databaseName);

      const result = await pool
        .request()

        .input("userId", sql.VarChar, userId).query(`
          SELECT
              ID,
              USERID,
              TITLE,
              MESSAGE,
              FROMUSER,
              DOCUMENTTYPE,
              ISREAD,
              CREATEDON,
              REFERENCEID,
              DATABASENAME
          FROM APP_NOTIFICATION
          WHERE USERID = @userId
        `);

      allNotifications.push(...result.recordset);
    }

    allNotifications.sort(
      (a, b) => new Date(b.CREATEDON) - new Date(a.CREATEDON),
    );

    res.json({
      success: true,
      data: allNotifications,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});
app.post("/api/read-notification", async (req, res) => {
  try {
    const { id, databaseName } = req.body;

    const pool = await getPool(databaseName);

    await pool
      .request()

      .input("id", sql.Int, id).query(`
        UPDATE APP_NOTIFICATION
        SET ISREAD = 1
        WHERE ID = @id
      `);

    res.json({
      success: true,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.post("/api/notification-count", async (req, res) => {
  try {
    const { userId, companies } = req.body;

    let totalCount = 0;

    for (const company of companies) {
      const databaseName = company.databaseName;

      if (!databaseName) continue;

      const pool = await getPool(databaseName);

      const result = await pool
        .request()

        .input("userId", sql.VarChar, userId).query(`
          SELECT COUNT(*) AS CNT
          FROM APP_NOTIFICATION
          WHERE USERID = @userId
            AND ISREAD = 0
        `);

      totalCount += result.recordset[0]?.CNT ?? 0;
    }

    res.json({
      success: true,
      count: totalCount,
    });
  } catch (err) {
    console.log("NOTIFICATION COUNT ERROR");
    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.post("/api/send-chat", async (req, res) => {
  try {
    const { databaseName, referenceId, fromUser, toUser, message } = req.body;

    const pool = await getPool(databaseName);

    // ==========================
    // SAVE CHAT MESSAGE
    // ==========================

    await pool
      .request()

      .input("REFERENCEID", sql.VarChar, referenceId)

      .input("FROMUSER", sql.VarChar, fromUser)

      .input("TOUSER", sql.VarChar, toUser)

      .input("MESSAGE", sql.NVarChar, message).query(`
        INSERT INTO APP_CHAT
        (
          REFERENCEID,
          FROMUSER,
          TOUSER,
          MESSAGE
        )
        VALUES
        (
          @REFERENCEID,
          @FROMUSER,
          @TOUSER,
          @MESSAGE
        )
      `);

    // ==========================
    // GET SENDER NAME
    // ==========================

    const senderResult = await pool
      .request()

      .input("USERID", sql.VarChar, fromUser).query(`
        SELECT SM63_6 AS USERNAME
        FROM SM63
        WHERE SM63_5=@USERID
      `);

    const senderName = senderResult.recordset[0]?.USERNAME || fromUser;

    // ==========================
    // SEND PUSH NOTIFICATION
    // ==========================

    const companyPool = await getPool();

    const tokenResult = await companyPool
      .request()

      .input("USERID", sql.VarChar, toUser).query(`
        SELECT DEVICETOKEN
        FROM APP_DEVICE_TOKEN
        WHERE USERID=@USERID
      `);

    if (tokenResult.recordset.length > 0) {
      const token = tokenResult.recordset[0].DEVICETOKEN;
      if (fromUser !== toUser) {
        for (const row of tokenResult.recordset) {
          await sendNotification(
            row.DEVICETOKEN,

            senderName,

            message,

            {
              type: "CHAT",

              fromUser: fromUser,

              fromName: senderName,

              referenceId: referenceId,

              databaseName: databaseName,
            },
          );
        }
      }
    }

    res.json({
      success: true,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,

      message: err.message,
    });
  }
});

app.post("/api/get-chat", async (req, res) => {
  try {
    const { databaseName, referenceId } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool
      .request()

      .input("REFERENCEID", sql.VarChar, referenceId).query(`
        SELECT *
        FROM APP_CHAT
        WHERE REFERENCEID=@REFERENCEID
        ORDER BY CREATEDON
      `);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.post("/api/create-srl-notification", async (req, res) => {
  console.log("BODY RECEIVED");
  console.log(req.body);
  try {
    const { databaseName, referenceId, targetUser, title, message } = req.body;

    const pool = await getPool(databaseName);

    const companyPool = await getPool();

    // ==========================
    // SAVE NOTIFICATION
    // ==========================

    await pool
      .request()

      .input("USERID", sql.VarChar, targetUser)

      .input("TITLE", sql.VarChar, title)

      .input("MESSAGE", sql.NVarChar, message)

      .input("REFERENCEID", sql.VarChar, referenceId)

      .input("DATABASENAME", sql.VarChar, databaseName).query(`
        INSERT INTO APP_NOTIFICATION
        (
          USERID,
          TITLE,
          MESSAGE,
          REFERENCEID,
          DATABASENAME,
          ISREAD,
          CREATEDON
        )
        VALUES
        (
          @USERID,
          @TITLE,
          @MESSAGE,
          @REFERENCEID,
          @DATABASENAME,
          0,
          GETDATE()
        )
      `);

    // ==========================
    // GET DEVICE TOKEN
    // ==========================

    const tokenResult = await companyPool
      .request()

      .input("userId", sql.VarChar, targetUser).query(`
        SELECT DEVICETOKEN
        FROM APP_DEVICE_TOKEN
        WHERE USERID='ADM'
      `);

    // ==========================
    // SEND FCM
    // ==========================

    if (tokenResult.recordset.length > 0) {
      const token = tokenResult.recordset[0].DEVICETOKEN;

      await sendNotification(
        token,

        "New SRL Approval",

        message,
      );
    }

    res.json({
      success: true,
    });
  } catch (err) {
    console.log("CREATE NOTIFICATION ERROR");
    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.post("/api/create-challan-notification", async (req, res) => {
  try {
    const { databaseName, referenceId, targetUser, title, message } = req.body;

    const pool = await getPool(databaseName);

    const companyPool = await getPool();

    const users = targetUser.split(",").map((x) => x.trim());

    for (const user of users) {
      await pool
        .request()

        .input("USERID", sql.VarChar, user)

        .input("TITLE", sql.VarChar, title)

        .input("MESSAGE", sql.NVarChar, message)

        .input("REFERENCEID", sql.VarChar, referenceId)

        .input("DATABASENAME", sql.VarChar, databaseName).query(`
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

      const tokenResult = await companyPool
        .request()

        .input("userId", sql.VarChar, user).query(`
            SELECT DEVICETOKEN
            FROM APP_DEVICE_TOKEN
            WHERE USERID=@userId
          `);

      if (tokenResult.recordset.length > 0) {
        await sendNotification(
          tokenResult.recordset[0].DEVICETOKEN,
          title,
          message,
        );
      }
    }

    res.json({
      success: true,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/* app.post("/api/chat-users", async (req, res) => {

  try {

    const {
      databaseName,
      userId
    } = req.body;

    const pool =
      await getPool(databaseName);

    const result =
      await pool.request()

      .input(
        "USERID",
        sql.VarChar,
        userId
      )

      .query(`

SELECT

CASE
WHEN c.FROMUSER=@USERID
THEN c.TOUSER
ELSE c.FROMUSER
END AS USERID,

s.SM63_6 AS USERNAME,

MAX(c.CREATEDON) AS LASTMESSAGEDATE,

SUM(
CASE
WHEN c.TOUSER=@USERID
AND ISNULL(c.ISREAD,0)=0
THEN 1
ELSE 0
END
) AS UNREADCOUNT

FROM APP_CHAT c

LEFT JOIN SM63 s

ON s.SM63_5 =

CASE
WHEN c.FROMUSER=@USERID
THEN c.TOUSER
ELSE c.FROMUSER
END

WHERE
c.FROMUSER=@USERID
OR c.TOUSER=@USERID

GROUP BY

CASE
WHEN c.FROMUSER=@USERID
THEN c.TOUSER
ELSE c.FROMUSER
END,

s.SM63_6

ORDER BY
MAX(c.CREATEDON) DESC

`);

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
 */

/*app.post("/api/chat-users", async (req, res) => {

  try {

    const {
      databaseName,
      userId
    } = req.body;

    const pool =
      await getPool(databaseName);

    const result =
      await pool.request()

      .input(
        "USERID",
        sql.VarChar,
        userId
      )

      .query(`

;WITH LASTCHAT AS
(

SELECT

CASE
WHEN FROMUSER=@USERID
THEN TOUSER
ELSE FROMUSER
END AS CHATUSER,

MESSAGE,

CREATEDON,

ROW_NUMBER() OVER
(
PARTITION BY
CASE
WHEN FROMUSER=@USERID
THEN TOUSER
ELSE FROMUSER
END
ORDER BY CREATEDON DESC
) RN

FROM APP_CHAT

WHERE
FROMUSER=@USERID
OR
TOUSER=@USERID

)

SELECT

L.CHATUSER AS USERID,

S.SM63_6 AS USERNAME,

L.MESSAGE AS LASTMESSAGE,

L.CREATEDON AS LASTMESSAGEDATE,

CASE

WHEN CAST(L.CREATEDON AS DATE)=CAST(GETDATE() AS DATE)
THEN FORMAT(L.CREATEDON,'hh:mm tt')

WHEN CAST(L.CREATEDON AS DATE)=DATEADD(DAY,-1,CAST(GETDATE() AS DATE))
THEN 'Yesterday'

ELSE FORMAT(L.CREATEDON,'dd MMM')

END AS TIME,

(

SELECT COUNT(*)

FROM APP_CHAT C

WHERE

C.FROMUSER=L.CHATUSER

AND
C.TOUSER=@USERID

AND
ISNULL(C.ISREAD,0)=0

) AS UNREADCOUNT

FROM LASTCHAT L

LEFT JOIN SM63 S

ON S.SM63_5=L.CHATUSER

WHERE RN=1

ORDER BY
L.CREATEDON DESC

`);

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
});*/

app.post("/api/chat-users", async (req, res) => {
  try {
    const { databaseName, userId } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool
      .request()

      .input("USERID", sql.VarChar, userId).query(`

;WITH LASTCHAT AS
(

SELECT

CASE
WHEN FROMUSER=@USERID
THEN TOUSER
ELSE FROMUSER
END AS CHATUSER,

MESSAGE,

CREATEDON,

ROW_NUMBER() OVER
(
PARTITION BY
CASE
WHEN FROMUSER=@USERID
THEN TOUSER
ELSE FROMUSER
END
ORDER BY CREATEDON DESC
) RN

FROM APP_CHAT

WHERE
FROMUSER=@USERID
OR
TOUSER=@USERID

)

SELECT

L.CHATUSER AS USERID,

S.SM63_6 AS USERNAME,

L.MESSAGE AS LASTMESSAGE,

L.CREATEDON AS LASTMESSAGEDATE,

CASE

WHEN CAST(L.CREATEDON AS DATE)=CAST(GETDATE() AS DATE)
THEN FORMAT(L.CREATEDON,'hh:mm tt')

WHEN CAST(L.CREATEDON AS DATE)=DATEADD(DAY,-1,CAST(GETDATE() AS DATE))
THEN 'Yesterday'

ELSE FORMAT(L.CREATEDON,'dd MMM')

END AS TIME,

(

SELECT COUNT(*)

FROM APP_CHAT C

WHERE

C.FROMUSER=L.CHATUSER

AND
C.TOUSER=@USERID

AND
ISNULL(C.ISREAD,0)=0

) AS UNREADCOUNT

FROM LASTCHAT L

LEFT JOIN SM63 S
  ON S.SM63_5 = L.CHATUSER
  OR CONVERT(NVARCHAR(100), S.UNQID) = L.CHATUSER

WHERE RN=1

ORDER BY
L.CREATEDON DESC

`);

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
// ==========================================================
// PIN TASK IN CHAT
// ==========================================================

app.post("/api/pin-chat-task", async (req, res) => {
  try {
    const { databaseName, referenceId, taskId, taskText, fromUser, toUser } =
      req.body;

    if (
      !databaseName ||
      !referenceId ||
      !taskId ||
      !taskText ||
      !fromUser ||
      !toUser
    ) {
      return res.status(400).json({
        success: false,
        message:
          "databaseName, referenceId, taskId, taskText, fromUser and toUser are required",
      });
    }

    const pool = await getPool(databaseName);

    // ======================================================
    // INSERT OR UPDATE
    // ======================================================

    await pool
      .request()

      .input("REFERENCEID", sql.VarChar(255), referenceId)

      .input("TASKID", sql.VarChar(100), taskId)

      .input("TASKTEXT", sql.NVarChar(sql.MAX), taskText)

      .input("FROMUSER", sql.VarChar(100), fromUser)

      .input("TOUSER", sql.VarChar(100), toUser).query(`
        IF EXISTS
        (
          SELECT 1
          FROM APP_CHAT_TASK_PIN
          WHERE REFERENCEID = @REFERENCEID
            AND TASKID = @TASKID
        )
        BEGIN

          UPDATE APP_CHAT_TASK_PIN

          SET
            TASKTEXT = @TASKTEXT,
            UPDATEDON = GETDATE()

          WHERE REFERENCEID = @REFERENCEID
            AND TASKID = @TASKID;

        END
        ELSE
        BEGIN

          INSERT INTO APP_CHAT_TASK_PIN
          (
            REFERENCEID,
            TASKID,
            TASKTEXT,
            FROMUSER,
            TOUSER,
            CREATEDON,
            UPDATEDON
          )

          VALUES
          (
            @REFERENCEID,
            @TASKID,
            @TASKTEXT,
            @FROMUSER,
            @TOUSER,
            GETDATE(),
            GETDATE()
          );

        END
      `);

    res.json({
      success: true,
      message: "Task pinned successfully",
    });
  } catch (err) {
    console.log("PIN CHAT TASK ERROR =", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});
// ==========================================================
// GET PINNED TASKS FOR CHAT
// ==========================================================

app.post("/api/get-chat-pins", async (req, res) => {
  try {
    const { databaseName, referenceId } = req.body;

    if (!databaseName || !referenceId) {
      return res.status(400).json({
        success: false,
        message: "databaseName and referenceId are required",
      });
    }

    const pool = await getPool(databaseName);

    const result = await pool
      .request()

      .input("REFERENCEID", sql.VarChar(255), referenceId).query(`
        SELECT
          PINID,
          REFERENCEID,
          TASKID,
          TASKTEXT,
          FROMUSER,
          TOUSER,
          CREATEDON,
          UPDATEDON

        FROM APP_CHAT_TASK_PIN

        WHERE REFERENCEID = @REFERENCEID

        ORDER BY CREATEDON DESC
      `);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.log("GET CHAT PINS ERROR =", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});
//group api's

// ======================================================
// CREATE GROUP
// ======================================================

app.post("/api/create-group", async (req, res) => {
  let transaction = null;

  try {
    const { databaseName, groupName, createdBy, members } = req.body;

    // ==================================================
    // VALIDATION
    // ==================================================

    if (!databaseName || !groupName || !createdBy) {
      return res.status(400).json({
        success: false,
        message: "databaseName, groupName and createdBy are required",
      });
    }

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Select at least one group member",
      });
    }

    // ==================================================
    // CLEAN VALUES
    // ==================================================

    const cleanGroupName = groupName.toString().trim();
    const cleanCreatedBy = createdBy.toString().trim();

    if (!cleanGroupName) {
      return res.status(400).json({
        success: false,
        message: "Group name cannot be empty",
      });
    }

    if (!cleanCreatedBy) {
      return res.status(400).json({
        success: false,
        message: "CreatedBy cannot be empty",
      });
    }

    // ==================================================
    // PREPARE MEMBERS
    // ==================================================

    const allMembers = [cleanCreatedBy, ...members];

    const uniqueMembers = [
      ...new Set(
        allMembers
          .map((userId) => userId?.toString().trim())
          .filter((userId) => userId)
          .map((userId) => userId.toUpperCase()),
      ),
    ];

    if (uniqueMembers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid group members found",
      });
    }

    console.log("======================================");
    console.log("CREATE GROUP API");
    console.log("Database:", databaseName);
    console.log("Group Name:", cleanGroupName);
    console.log("Created By:", cleanCreatedBy);
    console.log("Members:", uniqueMembers);
    console.log("======================================");

    // ==================================================
    // DATABASE CONNECTION
    // ==================================================

    const pool = await getPool(databaseName);

    // ==================================================
    // START TRANSACTION
    // ==================================================

    transaction = new sql.Transaction(pool);

    await transaction.begin();

    try {
      // ==================================================
      // STEP 1: CREATE GROUP
      // ==================================================

      const groupResult = await new sql.Request(transaction)
        .input("GROUPNAME", sql.VarChar, cleanGroupName)
        .input("CREATEDBY", sql.VarChar, cleanCreatedBy).query(`
          INSERT INTO CHATGROUPS
          (
            GROUPNAME,
            CREATEDBY
          )
          OUTPUT INSERTED.GROUPID
          VALUES
          (
            @GROUPNAME,
            @CREATEDBY
          )
        `);

      if (!groupResult.recordset || groupResult.recordset.length === 0) {
        throw new Error("Group could not be created");
      }

      const groupId = groupResult.recordset[0].GROUPID;

      console.log("GROUP CREATED:", groupId);

      // ==================================================
      // STEP 2: ADD GROUP MEMBERS
      // ==================================================

      for (const userId of uniqueMembers) {
        await new sql.Request(transaction)
          .input("GROUPID", sql.Int, groupId)
          .input("USERID", sql.VarChar, userId).query(`
            INSERT INTO CHATGROUPMEMBERS
            (
              GROUPID,
              USERID
            )
            VALUES
            (
              @GROUPID,
              @USERID
            )
          `);

        console.log("GROUP MEMBER ADDED:", userId);
      }

      // ==================================================
      // STEP 3: COMMIT
      // ==================================================

      await transaction.commit();

      transaction = null;

      console.log("GROUP CREATED SUCCESSFULLY:", groupId);

      return res.status(200).json({
        success: true,
        message: "Group created successfully",
        groupId: groupId,
        groupName: cleanGroupName,
        createdBy: cleanCreatedBy,
        members: uniqueMembers,
      });
    } catch (error) {
      // ==================================================
      // ROLLBACK
      // ==================================================

      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.log("Transaction Rollback Error:", rollbackError);
        }
      }

      throw error;
    }
  } catch (err) {
    console.log("======================================");

    console.log("CREATE GROUP ERROR:");

    console.log(err);

    console.log("======================================");

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create group",
    });
  }
});

// ======================================================
// GET MY GROUPS
// ======================================================

app.post("/api/my-groups", async (req, res) => {
  try {
    const { databaseName, userId } = req.body;

    // ==================================================
    // VALIDATION
    // ==================================================

    if (!databaseName || !userId) {
      return res.status(400).json({
        success: false,
        message: "databaseName and userId are required",
      });
    }

    const cleanUserId = userId.toString().trim();

    if (!cleanUserId) {
      return res.status(400).json({
        success: false,
        message: "userId cannot be empty",
      });
    }

    console.log("======================================");
    console.log("GET MY GROUPS");
    console.log("Database:", databaseName);
    console.log("User ID:", cleanUserId);
    console.log("======================================");

    // ==================================================
    // DATABASE CONNECTION
    // ==================================================

    const pool = await getPool(databaseName);

    // ==================================================
    // GET GROUPS
    // ==================================================

    const result = await pool
      .request()
      .input("USERID", sql.VarChar, cleanUserId).query(`
        SELECT
          G.GROUPID,
          G.GROUPNAME,
          G.CREATEDBY,

          (
            SELECT TOP 1
              AC.MESSAGE
            FROM APP_CHAT AC
            WHERE AC.REFERENCEID =
                  CAST(G.GROUPID AS VARCHAR)
              AND AC.DOCUMENTTYPE = 'GROUP'
            ORDER BY
              AC.CREATEDON DESC
          ) AS LASTMESSAGE,

          (
            SELECT TOP 1
              AC.CREATEDON
            FROM APP_CHAT AC
            WHERE AC.REFERENCEID =
                  CAST(G.GROUPID AS VARCHAR)
              AND AC.DOCUMENTTYPE = 'GROUP'
            ORDER BY
              AC.CREATEDON DESC
          ) AS LASTMESSAGEDATE

        FROM CHATGROUPS G

        INNER JOIN CHATGROUPMEMBERS GM
          ON G.GROUPID = GM.GROUPID

        WHERE UPPER(
                LTRIM(RTRIM(GM.USERID))
              )
              =
              UPPER(
                LTRIM(RTRIM(@USERID))
              )

        ORDER BY
          CASE
            WHEN LASTMESSAGEDATE IS NULL
            THEN 1
            ELSE 0
          END,

          LASTMESSAGEDATE DESC,

          G.GROUPID DESC
      `);

    console.log("GROUPS FOUND:", result.recordset.length);

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.log("======================================");

    console.log("GET MY GROUPS ERROR:");

    console.log(err);

    console.log("======================================");

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to load groups",
    });
  }
});
// ======================================================
// RENAME GROUP
// ======================================================

app.post("/api/rename-group", async (req, res) => {
  try {
    const { databaseName, groupId, groupName, userId } = req.body;

    // ==================================================
    // VALIDATION
    // ==================================================

    if (!databaseName || !groupId || !groupName || !userId) {
      return res.status(400).json({
        success: false,
        message: "databaseName, groupId, groupName and userId are required",
      });
    }

    const cleanGroupName = groupName.toString().trim();

    const cleanUserId = userId.toString().trim();

    const numericGroupId = Number(groupId);

    if (!cleanGroupName) {
      return res.status(400).json({
        success: false,
        message: "Group name cannot be empty",
      });
    }

    if (!cleanUserId) {
      return res.status(400).json({
        success: false,
        message: "User ID cannot be empty",
      });
    }

    if (!Number.isInteger(numericGroupId) || numericGroupId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid group ID",
      });
    }

    console.log("======================================");

    console.log("RENAME GROUP API");

    console.log("Database:", databaseName);

    console.log("Group ID:", numericGroupId);

    console.log("New Group Name:", cleanGroupName);

    console.log("Requested By:", cleanUserId);

    console.log("======================================");

    // ==================================================
    // DATABASE CONNECTION
    // ==================================================

    const pool = await getPool(databaseName);

    // ==================================================
    // CHECK GROUP CREATOR
    // ==================================================

    const check = await pool
      .request()
      .input("GROUPID", sql.Int, numericGroupId)
      .input("USERID", sql.VarChar, cleanUserId).query(`
          SELECT
            GROUPID,
            CREATEDBY
          FROM CHATGROUPS
          WHERE GROUPID = @GROUPID
            AND UPPER(
              LTRIM(RTRIM(CREATEDBY))
            )
            =
            UPPER(
              LTRIM(RTRIM(@USERID))
            )
        `);

    // ==================================================
    // GROUP NOT FOUND / USER NOT CREATOR
    // ==================================================

    if (!check.recordset || check.recordset.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Only group creator can rename this group",
      });
    }

    // ==================================================
    // UPDATE GROUP NAME
    // ==================================================

    const updateResult = await pool
      .request()
      .input("GROUPID", sql.Int, numericGroupId)
      .input("GROUPNAME", sql.VarChar, cleanGroupName).query(`
          UPDATE CHATGROUPS
          SET GROUPNAME = @GROUPNAME
          WHERE GROUPID = @GROUPID
        `);

    // ==================================================
    // CHECK UPDATE
    // ==================================================

    if (!updateResult.rowsAffected || updateResult.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    console.log("GROUP RENAMED SUCCESSFULLY:", numericGroupId);

    // ==================================================
    // SUCCESS
    // ==================================================

    return res.status(200).json({
      success: true,
      message: "Group renamed successfully",
      groupId: numericGroupId,
      groupName: cleanGroupName,
    });
  } catch (err) {
    console.log("======================================");

    console.log("RENAME GROUP ERROR:");

    console.log(err);

    console.log("======================================");

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to rename group",
    });
  }
});
// ======================================================
// DELETE GROUP
// ======================================================

app.post("/api/delete-group", async (req, res) => {
  let transaction = null;

  try {
    const { databaseName, groupId, userId } = req.body;

    // ==================================================
    // VALIDATION
    // ==================================================

    if (!databaseName || !groupId || !userId) {
      return res.status(400).json({
        success: false,
        message: "databaseName, groupId and userId are required",
      });
    }

    const cleanUserId = userId.toString().trim();

    const numericGroupId = Number(groupId);

    if (!cleanUserId) {
      return res.status(400).json({
        success: false,
        message: "User ID cannot be empty",
      });
    }

    if (!Number.isInteger(numericGroupId) || numericGroupId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid group ID",
      });
    }

    console.log("======================================");

    console.log("DELETE GROUP API");

    console.log("Database:", databaseName);

    console.log("Group ID:", numericGroupId);

    console.log("Requested By:", cleanUserId);

    console.log("======================================");

    // ==================================================
    // DATABASE CONNECTION
    // ==================================================

    const pool = await getPool(databaseName);

    // ==================================================
    // CHECK GROUP CREATOR
    // ==================================================

    const check = await pool
      .request()
      .input("GROUPID", sql.Int, numericGroupId)
      .input("USERID", sql.VarChar, cleanUserId).query(`
          SELECT
            GROUPID,
            CREATEDBY
          FROM CHATGROUPS
          WHERE GROUPID = @GROUPID
            AND UPPER(
              LTRIM(RTRIM(CREATEDBY))
            )
            =
            UPPER(
              LTRIM(RTRIM(@USERID))
            )
        `);

    // ==================================================
    // GROUP NOT FOUND / NOT CREATOR
    // ==================================================

    if (!check.recordset || check.recordset.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Only group creator can delete this group",
      });
    }

    // ==================================================
    // START TRANSACTION
    // ==================================================

    transaction = new sql.Transaction(pool);

    await transaction.begin();

    try {
      // ==================================================
      // STEP 1: DELETE GROUP MESSAGES
      // ==================================================

      const messageDelete = await new sql.Request(transaction).input(
        "REFERENCEID",
        sql.VarChar,
        numericGroupId.toString(),
      ).query(`
            DELETE FROM APP_CHAT
            WHERE REFERENCEID = @REFERENCEID
              AND DOCUMENTTYPE = 'GROUP'
          `);

      console.log("GROUP MESSAGES DELETED:", messageDelete.rowsAffected[0]);

      // ==================================================
      // STEP 2: DELETE GROUP MEMBERS
      // ==================================================

      const memberDelete = await new sql.Request(transaction).input(
        "GROUPID",
        sql.Int,
        numericGroupId,
      ).query(`
            DELETE FROM CHATGROUPMEMBERS
            WHERE GROUPID = @GROUPID
          `);

      console.log("GROUP MEMBERS DELETED:", memberDelete.rowsAffected[0]);

      // ==================================================
      // STEP 3: DELETE GROUP
      // ==================================================

      const groupDelete = await new sql.Request(transaction).input(
        "GROUPID",
        sql.Int,
        numericGroupId,
      ).query(`
            DELETE FROM CHATGROUPS
            WHERE GROUPID = @GROUPID
          `);

      // ==================================================
      // VERIFY GROUP DELETE
      // ==================================================

      if (!groupDelete.rowsAffected || groupDelete.rowsAffected[0] === 0) {
        throw new Error("Group could not be deleted");
      }

      console.log("GROUP DELETED:", numericGroupId);

      // ==================================================
      // STEP 4: COMMIT
      // ==================================================

      await transaction.commit();

      transaction = null;

      console.log("GROUP DELETE SUCCESSFUL");

      // ==================================================
      // SUCCESS RESPONSE
      // ==================================================

      return res.status(200).json({
        success: true,
        message: "Group deleted successfully",
        groupId: numericGroupId,
      });
    } catch (error) {
      // ==================================================
      // ROLLBACK
      // ==================================================

      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.log("Transaction Rollback Error:", rollbackError);
        }
      }

      throw error;
    }
  } catch (err) {
    console.log("======================================");

    console.log("DELETE GROUP ERROR:");

    console.log(err);

    console.log("======================================");

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to delete group",
    });
  }
});
// ======================================================
// REMOVE GROUP MEMBER
// ======================================================

app.post("/api/remove-group-member", async (req, res) => {
  try {
    const { databaseName, groupId, userId, requestedBy } = req.body;

    // ==================================================
    // VALIDATION
    // ==================================================

    if (!databaseName || !groupId || !userId || !requestedBy) {
      return res.status(400).json({
        success: false,
        message: "databaseName, groupId, userId and requestedBy are required",
      });
    }

    const numericGroupId = Number(groupId);

    const cleanUserId = userId.toString().trim();

    const cleanRequestedBy = requestedBy.toString().trim();

    if (!Number.isInteger(numericGroupId) || numericGroupId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid group ID",
      });
    }

    if (!cleanUserId) {
      return res.status(400).json({
        success: false,
        message: "User ID cannot be empty",
      });
    }

    if (!cleanRequestedBy) {
      return res.status(400).json({
        success: false,
        message: "RequestedBy cannot be empty",
      });
    }

    console.log("======================================");

    console.log("REMOVE GROUP MEMBER API");

    console.log("Database:", databaseName);

    console.log("Group ID:", numericGroupId);

    console.log("Member:", cleanUserId);

    console.log("Requested By:", cleanRequestedBy);

    console.log("======================================");

    // ==================================================
    // DATABASE CONNECTION
    // ==================================================

    const pool = await getPool(databaseName);

    // ==================================================
    // STEP 1:
    // CHECK THAT REQUESTED USER IS GROUP CREATOR
    // ==================================================

    const creatorCheck = await pool
      .request()
      .input("GROUPID", sql.Int, numericGroupId)
      .input("REQUESTEDBY", sql.VarChar, cleanRequestedBy).query(`
          SELECT
            GROUPID,
            CREATEDBY
          FROM CHATGROUPS
          WHERE GROUPID = @GROUPID
            AND UPPER(
              LTRIM(RTRIM(CREATEDBY))
            )
            =
            UPPER(
              LTRIM(RTRIM(@REQUESTEDBY))
            )
        `);

    // ==================================================
    // NOT CREATOR
    // ==================================================

    if (!creatorCheck.recordset || creatorCheck.recordset.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Only group creator can remove members",
      });
    }

    // ==================================================
    // STEP 2:
    // CREATOR CANNOT REMOVE HIMSELF
    // ==================================================

    const selfRemoveCheck = await pool
      .request()
      .input("GROUPID", sql.Int, numericGroupId)
      .input("USERID", sql.VarChar, cleanUserId).query(`
          SELECT
            GROUPID
          FROM CHATGROUPS
          WHERE GROUPID = @GROUPID
            AND UPPER(
              LTRIM(RTRIM(CREATEDBY))
            )
            =
            UPPER(
              LTRIM(RTRIM(@USERID))
            )
        `);

    if (selfRemoveCheck.recordset && selfRemoveCheck.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Group creator cannot be removed",
      });
    }

    // ==================================================
    // STEP 3:
    // CHECK MEMBER EXISTS
    // ==================================================

    const memberCheck = await pool
      .request()
      .input("GROUPID", sql.Int, numericGroupId)
      .input("USERID", sql.VarChar, cleanUserId).query(`
          SELECT
            GROUPID,
            USERID
          FROM CHATGROUPMEMBERS
          WHERE GROUPID = @GROUPID
            AND UPPER(
              LTRIM(RTRIM(USERID))
            )
            =
            UPPER(
              LTRIM(RTRIM(@USERID))
            )
        `);

    if (!memberCheck.recordset || memberCheck.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Member not found in this group",
      });
    }

    // ==================================================
    // STEP 4:
    // REMOVE MEMBER
    // ==================================================

    const result = await pool
      .request()
      .input("GROUPID", sql.Int, numericGroupId)
      .input("USERID", sql.VarChar, cleanUserId).query(`
          DELETE FROM CHATGROUPMEMBERS
          WHERE GROUPID = @GROUPID
            AND UPPER(
              LTRIM(RTRIM(USERID))
            )
            =
            UPPER(
              LTRIM(RTRIM(@USERID))
            )
        `);

    // ==================================================
    // VERIFY DELETE
    // ==================================================

    if (!result.rowsAffected || result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: "Member could not be removed",
      });
    }

    console.log("MEMBER REMOVED SUCCESSFULLY:", cleanUserId);

    // ==================================================
    // SUCCESS
    // ==================================================

    return res.status(200).json({
      success: true,
      message: "Member removed successfully",
      groupId: numericGroupId,
      userId: cleanUserId,
    });
  } catch (err) {
    console.log("======================================");

    console.log("REMOVE GROUP MEMBER ERROR:");

    console.log(err);

    console.log("======================================");

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to remove group member",
    });
  }
});
// ======================================================
// GET GROUP DETAILS
// ======================================================

app.post("/api/group-details", async (req, res) => {
  try {
    const { databaseName, groupId } = req.body;

    // ==================================================
    // VALIDATION
    // ==================================================

    if (!databaseName || !groupId) {
      return res.status(400).json({
        success: false,
        message: "databaseName and groupId are required",
      });
    }

    const numericGroupId = Number(groupId);

    if (!Number.isInteger(numericGroupId) || numericGroupId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid group ID",
      });
    }

    // ==================================================
    // DATABASE CONNECTION
    // ==================================================

    const pool = await getPool(databaseName);

    // ==================================================
    // GET GROUP
    // ==================================================

    const result = await pool
      .request()
      .input("GROUPID", sql.Int, numericGroupId).query(`
          SELECT
            GROUPID,
            GROUPNAME,
            CREATEDBY
          FROM CHATGROUPS
          WHERE GROUPID = @GROUPID
        `);

    // ==================================================
    // GROUP NOT FOUND
    // ==================================================

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // ==================================================
    // SUCCESS
    // ==================================================

    return res.status(200).json({
      success: true,
      data: result.recordset[0],
    });
  } catch (err) {
    console.log("Group Details Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get group details",
    });
  }
});
// ======================================================
// LEAVE GROUP
// ======================================================

app.post("/api/leave-group", async (req, res) => {
  try {
    const { databaseName, groupId, userId } = req.body;

    // ==================================================
    // VALIDATION
    // ==================================================

    if (!databaseName || !groupId || !userId) {
      return res.status(400).json({
        success: false,
        message: "databaseName, groupId and userId are required",
      });
    }

    const numericGroupId = Number(groupId);

    const cleanUserId = userId.toString().trim();

    if (!Number.isInteger(numericGroupId) || numericGroupId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid group ID",
      });
    }

    if (!cleanUserId) {
      return res.status(400).json({
        success: false,
        message: "User ID cannot be empty",
      });
    }

    // ==================================================
    // DATABASE CONNECTION
    // ==================================================

    const pool = await getPool(databaseName);

    // ==================================================
    // CHECK GROUP EXISTS
    // ==================================================

    const groupCheck = await pool
      .request()
      .input("GROUPID", sql.Int, numericGroupId).query(`
          SELECT
            GROUPID,
            CREATEDBY
          FROM CHATGROUPS
          WHERE GROUPID = @GROUPID
        `);

    if (!groupCheck.recordset || groupCheck.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // ==================================================
    // CREATOR CANNOT LEAVE
    // ==================================================

    const createdBy = groupCheck.recordset[0].CREATEDBY;

    if (
      createdBy &&
      createdBy.toString().trim().toUpperCase() === cleanUserId.toUpperCase()
    ) {
      return res.status(400).json({
        success: false,
        message: "Group creator cannot leave the group",
      });
    }

    // ==================================================
    // REMOVE USER FROM GROUP
    // ==================================================

    const result = await pool
      .request()
      .input("GROUPID", sql.Int, numericGroupId)
      .input("USERID", sql.VarChar, cleanUserId).query(`
          DELETE FROM CHATGROUPMEMBERS
          WHERE GROUPID = @GROUPID
            AND UPPER(
              LTRIM(RTRIM(USERID))
            )
            =
            UPPER(
              LTRIM(RTRIM(@USERID))
            )
        `);

    // ==================================================
    // USER WAS NOT A MEMBER
    // ==================================================

    if (!result.rowsAffected || result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: "You are not a member of this group",
      });
    }

    // ==================================================
    // SUCCESS
    // ==================================================

    console.log("USER LEFT GROUP:", cleanUserId, numericGroupId);

    return res.status(200).json({
      success: true,
      message: "You left the group successfully",
      groupId: numericGroupId,
      userId: cleanUserId,
    });
  } catch (err) {
    console.log("Leave Group Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to leave group",
    });
  }
});
// ======================================================
// GET GROUP MEMBERS
// ======================================================

// ======================================================
// GET GROUP MEMBERS
// ======================================================

app.post("/api/group-members", async (req, res) => {
  try {
    const { databaseName, groupId } = req.body;

    // ==================================================
    // VALIDATION
    // ==================================================

    if (!databaseName || !groupId) {
      return res.status(400).json({
        success: false,
        message: "databaseName and groupId are required",
      });
    }

    const numericGroupId = Number(groupId);

    if (!Number.isInteger(numericGroupId) || numericGroupId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid group ID",
      });
    }

    // ==================================================
    // DATABASE CONNECTION
    // ==================================================

    const pool = await getPool(databaseName);

    // ==================================================
    // GET GROUP CREATOR
    // ==================================================

    const groupResult = await pool
      .request()
      .input("GROUPID", sql.Int, numericGroupId).query(`
        SELECT
          GROUPID,
          CREATEDBY
        FROM CHATGROUPS
        WHERE GROUPID = @GROUPID
      `);

    // ==================================================
    // GROUP NOT FOUND
    // ==================================================

    if (!groupResult.recordset || groupResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    const createdBy =
      groupResult.recordset[0].CREATEDBY?.toString().trim() || "";

    // ==================================================
    // GET GROUP MEMBERS
    // ==================================================

    const result = await pool
      .request()
      .input("GROUPID", sql.Int, numericGroupId)
      .input("CREATEDBY", sql.VarChar, createdBy).query(`
        SELECT
          GM.USERID,

          ISNULL(
            SM.SM63_6,
            GM.USERID
          ) AS USERNAME

        FROM CHATGROUPMEMBERS GM

        LEFT JOIN SM63 SM
          ON UPPER(
            LTRIM(RTRIM(SM.SM63_5))
          )
          =
          UPPER(
            LTRIM(RTRIM(GM.USERID))
          )

        WHERE GM.GROUPID = @GROUPID

        ORDER BY
          CASE
            WHEN UPPER(
              LTRIM(RTRIM(GM.USERID))
            )
            =
            UPPER(
              LTRIM(RTRIM(@CREATEDBY))
            )
            THEN 0
            ELSE 1
          END,

          USERNAME
      `);

    // ==================================================
    // SUCCESS
    // ==================================================

    console.log("GROUP MEMBERS:", numericGroupId, result.recordset.length);

    return res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.log("======================================");

    console.log("GROUP MEMBERS ERROR:");

    console.log(err);

    console.log("======================================");

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get group members",
    });
  }
});
// ======================================================
// SEND GROUP MESSAGE
// ======================================================

app.post("/api/group-message", async (req, res) => {
  try {
    const { databaseName, groupId, fromUser, message } = req.body;

    // ==================================================
    // VALIDATION
    // ==================================================

    if (!databaseName || !groupId || !fromUser || !message) {
      return res.status(400).json({
        success: false,
        message: "databaseName, groupId, fromUser and message are required",
      });
    }

    const numericGroupId = Number(groupId);

    const cleanFromUser = fromUser.toString().trim();

    const cleanMessage = message.toString().trim();

    if (!Number.isInteger(numericGroupId) || numericGroupId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid group ID",
      });
    }

    if (!cleanFromUser) {
      return res.status(400).json({
        success: false,
        message: "fromUser cannot be empty",
      });
    }

    if (!cleanMessage) {
      return res.status(400).json({
        success: false,
        message: "Message cannot be empty",
      });
    }

    // ==================================================
    // DATABASE CONNECTION
    // ==================================================

    const pool = await getPool(databaseName);

    // ==================================================
    // CHECK GROUP EXISTS
    // ==================================================

    const groupCheck = await pool
      .request()
      .input("GROUPID", sql.Int, numericGroupId).query(`
          SELECT
            GROUPID
          FROM CHATGROUPS
          WHERE GROUPID = @GROUPID
        `);

    if (!groupCheck.recordset || groupCheck.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // ==================================================
    // CHECK USER IS GROUP MEMBER
    // ==================================================

    const memberCheck = await pool
      .request()
      .input("GROUPID", sql.Int, numericGroupId)
      .input("USERID", sql.VarChar, cleanFromUser).query(`
          SELECT
            GROUPID,
            USERID
          FROM CHATGROUPMEMBERS
          WHERE GROUPID = @GROUPID
            AND UPPER(
              LTRIM(RTRIM(USERID))
            )
            =
            UPPER(
              LTRIM(RTRIM(@USERID))
            )
        `);

    if (!memberCheck.recordset || memberCheck.recordset.length === 0) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group",
      });
    }

    // ==================================================
    // INSERT MESSAGE
    // ==================================================

    const result = await pool
      .request()
      .input("REFERENCEID", sql.VarChar, numericGroupId.toString())
      .input("FROMUSER", sql.VarChar, cleanFromUser)
      .input("MESSAGE", sql.NVarChar, cleanMessage)
      .input("DOCUMENTTYPE", sql.VarChar, "GROUP").query(`
          INSERT INTO APP_CHAT
          (
            REFERENCEID,
            FROMUSER,
            MESSAGE,
            DOCUMENTTYPE,
            CREATEDON
          )
          VALUES
          (
            @REFERENCEID,
            @FROMUSER,
            @MESSAGE,
            @DOCUMENTTYPE,
            GETDATE()
          );

          SELECT
            SCOPE_IDENTITY() AS CHATID;
        `);

    const chatId = result.recordset?.[0]?.CHATID ?? null;

    console.log("GROUP MESSAGE SENT:", {
      groupId: numericGroupId,
      fromUser: cleanFromUser,
      chatId: chatId,
    });

    // ==================================================
    // SUCCESS
    // ==================================================

    return res.status(200).json({
      success: true,
      message: "Group message sent successfully",
      groupId: numericGroupId,
      chatId: chatId,
    });
  } catch (err) {
    console.log("======================================");

    console.log("GROUP MESSAGE ERROR:");

    console.log(err);

    console.log("======================================");

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to send group message",
    });
  }
});
// ======================================================
// GET GROUP MESSAGES
// ======================================================

app.post("/api/group-messages", async (req, res) => {
  try {
    const { databaseName, groupId } = req.body;

    // ==================================================
    // VALIDATION
    // ==================================================

    if (!databaseName || !groupId) {
      return res.status(400).json({
        success: false,
        message: "databaseName and groupId are required",
      });
    }

    const numericGroupId = Number(groupId);

    if (!Number.isInteger(numericGroupId) || numericGroupId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid group ID",
      });
    }

    // ==================================================
    // DATABASE CONNECTION
    // ==================================================

    const pool = await getPool(databaseName);

    // ==================================================
    // CHECK GROUP EXISTS
    // ==================================================

    const groupCheck = await pool
      .request()
      .input("GROUPID", sql.Int, numericGroupId).query(`
          SELECT
            GROUPID
          FROM CHATGROUPS
          WHERE GROUPID = @GROUPID
        `);

    if (!groupCheck.recordset || groupCheck.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // ==================================================
    // GET GROUP MESSAGES
    // ==================================================

    const result = await pool
      .request()
      .input("REFERENCEID", sql.VarChar, numericGroupId.toString()).query(`
          SELECT
            FROMUSER,
            MESSAGE,
            CREATEDON
          FROM APP_CHAT
          WHERE REFERENCEID = @REFERENCEID
            AND DOCUMENTTYPE = 'GROUP'
          ORDER BY
            CREATEDON ASC
        `);

    // ==================================================
    // SUCCESS
    // ==================================================

    console.log("GROUP MESSAGES:", numericGroupId, result.recordset.length);

    return res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.log("======================================");

    console.log("GET GROUP MESSAGES ERROR:");

    console.log(err);

    console.log("======================================");

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get group messages",
    });
  }
});

//group
app.post("/api/all-userslist", async (req, res) => {
  try {
    const { databaseName, userId } = req.body;

    console.log("ALL USERS API");
    console.log("databaseName =", databaseName);
    console.log("userId =", userId);

    if (!databaseName || !userId) {
      return res.status(400).json({
        success: false,
        message: "databaseName and userId are required",
      });
    }

    const pool = await getPool(databaseName);

    const result = await pool.request().input("userid", sql.VarChar, userId)
      .query(`
        SELECT 
    S.SM63_5 AS data,
    S.SM63_6 AS value,
    B.SM1002_7 AS branch
FROM SM63 S

LEFT JOIN SM1002 B
    ON B.SM1002_5 = S.SM63_12

WHERE S.SM63_12 IN
(
    SELECT data
    FROM dbo.split(
        (
            SELECT SM63_12
            FROM SM63
            WHERE SM63_5 = @userid
        ),
        ','
    )
)

ORDER BY S.SM63_6;
      `);

    console.log("ALL USERS RESULT =", result.recordset);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.log("ALL USERS ERROR =", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.post("/api/read-chat", async (req, res) => {
  const { databaseName, currentUser, targetUser } = req.body;

  const pool = await getPool(databaseName);

  await pool
    .request()

    .input("CURRENTUSER", sql.VarChar, currentUser)
    .input("TARGETUSER", sql.VarChar, targetUser).query(`
      UPDATE APP_CHAT
      SET ISREAD = 1
      WHERE TOUSER=@CURRENTUSER
      AND FROMUSER=@TARGETUSER
      AND ISREAD=0
    `);

  res.json({ success: true });
});

app.post("/api/chat-list", async (req, res) => {
  const { databaseName, userId } = req.body;

  const pool = await getPool(databaseName);

  const result = await pool
    .request()

    .input("USERID", sql.VarChar, userId).query(`

SELECT

CASE
WHEN FROMUSER=@USERID
THEN TOUSER
ELSE FROMUSER
END AS CHATUSER,

MAX(CREATEDON) CREATEDON

FROM APP_CHAT

WHERE
FROMUSER=@USERID
OR TOUSER=@USERID

GROUP BY

CASE
WHEN FROMUSER=@USERID
THEN TOUSER
ELSE FROMUSER
END

ORDER BY
MAX(CREATEDON) DESC

`);

  res.json(result.recordset);
});

/* app.post("/api/all-users", async (req, res) => {

  try {

    const {
      databaseName
    } = req.body;

    const pool =
      await getPool(databaseName);

    const result =
      await pool.request()

      .query(`
        SELECT
          SM63_5 AS USERID,
          SM63_6 AS USERNAME
        FROM SM63
        ORDER BY SM63_6
      `);

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
}); */

app.post("/api/all-users", async (req, res) => {
  try {
    const { databaseName, userId, level } = req.body;

    console.log("=================================");
    console.log("ALL USERS API");
    console.log("databaseName =", databaseName);
    console.log("userId =", userId);
    console.log("level =", level);
    console.log("=================================");

    if (!databaseName || !userId || level === undefined || level === null) {
      return res.status(400).json({
        success: false,
        message: "databaseName, userId, and level are required",
      });
    }

    const pool = await getPool(databaseName);

    const result = await pool
      .request()
      .input("userid", sql.VarChar, String(userId))
      .input("level", sql.Int, Number(level)).query(`
        SELECT
            s63.UNQID AS data,

            -- EMPLOYEE NAME
            s63.SM63_6 AS value,

            -- BRANCH CITY ONLY
            CASE
                WHEN CHARINDEX('(', b.SM1002_7) > 0
                     AND CHARINDEX(')', b.SM1002_7) >
                         CHARINDEX('(', b.SM1002_7)
                THEN
                    LTRIM(RTRIM(
                        SUBSTRING(
                            b.SM1002_7,
                            CHARINDEX('(', b.SM1002_7) + 1,
                            CHARINDEX(')', b.SM1002_7)
                            - CHARINDEX('(', b.SM1002_7) - 1
                        )
                    ))
                ELSE
                    LTRIM(RTRIM(b.SM1002_7))
            END AS branch

        FROM SM63 AS s63

        INNER JOIN SM61 AS s61
            ON s61.UNQID = s63.SM63_8

        LEFT JOIN SM1002 AS b
            ON b.SM1002_5 = s63.SM63_12

        WHERE EXISTS
        (
            SELECT 1

            FROM dbo.split(
                s63.SM63_12,
                ','
            ) AS user_access

            INNER JOIN dbo.split
            (
                (
                    SELECT SM63_12
                    FROM SM63
                    WHERE SM63_5 = @userid
                ),
                ','
            ) AS requested_access

                ON LTRIM(RTRIM(user_access.data)) =
                   LTRIM(RTRIM(requested_access.data))
        )

        AND
        (
            CASE

                WHEN @level = (
                    SELECT MAX(
                        TRY_CONVERT(
                            INT,
                            SM61_9
                        )
                    )
                    FROM SM61
                )

                THEN
                    CASE
                        WHEN TRY_CONVERT(
                            INT,
                            s61.SM61_9
                        ) > @level
                        THEN 1
                        ELSE 0
                    END

                ELSE
                    CASE
                        WHEN TRY_CONVERT(
                            INT,
                            s61.SM61_9
                        ) >= @level
                        THEN 1
                        ELSE 0
                    END

            END
        ) = 1

        ORDER BY s63.SM63_6;
      `);

    console.log("ALL USERS RESULT COUNT =", result.recordset.length);

    console.log("ALL USERS RESULT =", result.recordset);

    return res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.log("=================================");
    console.log("ALL USERS ERROR");
    console.log(err);
    console.log("=================================");

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.post("/api/customer-follow-up", async (req, res) => {
  try {
    const { databaseName, userId } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool
      .request()

      .input("WHAT", sql.VarChar, "CUSTOMER_FOLLOW_UP")
      .input("USERID", sql.VarChar, userId)

      .execute("A_SP_FOR_DASHBOARD_APP");

    res.json({
      success: true,
      customers: result.recordset,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.post("/api/lost-customers", async (req, res) => {
  try {
    const { databaseName, userId, filter, basis, paymentFilter } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool
      .request()
      .input("what", sql.VarChar, "LOST_CUSTOMERS")
      .input("userid", sql.VarChar, userId)
      .input("filter", sql.VarChar, filter)
      .input("basis", sql.VarChar, basis)
      .input("paymentfilter", sql.VarChar, paymentFilter)
      .execute("A_SP_FOR_DASHBOARD_APP");

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message,
    });
  }
});

app.post("/api/category-target", async (req, res) => {
  try {
    const { databaseName, userId } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool
      .request()

      .input("WHAT", sql.NVarChar(100), "CATEGORYWISE_TARGET")
      .input("USERID", sql.NVarChar(100), userId)

      .execute("A_SP_FOR_DASHBOARD_APP");

    res.json({
      list: result.recordsets[0],

      summary: result.recordsets[1][0],
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.post("/api/customer-health", async (req, res) => {
  try {
    const { databaseName, userId } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool
      .request()

      .input("WHAT", sql.NVarChar(100), "CUSTOMER_HEALTH")
      .input("USERID", sql.NVarChar(100), userId)

      .execute("A_SP_FOR_DASHBOARD_APP");

    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,

      message: err.message,
    });
  }
});

app.post("/api/category-decline", async (req, res) => {
  try {
    const { databaseName, userId } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool
      .request()

      .input("WHAT", sql.NVarChar(100), "PRODUCT_DECLINE")
      .input("USERID", sql.NVarChar(100), userId)

      .execute("A_SP_FOR_DASHBOARD_APP");

    res.json(result.recordset);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.post("/api/category-customers", async (req, res) => {
  try {
    const { databaseName, userId, categoryName } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool
      .request()

      .input("WHAT", sql.NVarChar(100), "CATEGORY_TARGET_CUSTOMERS")

      .input("USERID", sql.NVarChar(100), userId)

      .input("CATEGORYNAME", sql.NVarChar(200), categoryName)

      .execute("A_SP_FOR_DASHBOARD_APP");

    res.json(result.recordset);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,

      message: err.message,
    });
  }
});

app.post("/api/customer-products", async (req, res) => {
  try {
    const { databaseName, userId, customerId } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool
      .request()

      .input("WHAT", sql.NVarChar(100), "CUSTOMER_PRODUCTS")

      .input("USERID", sql.NVarChar(100), userId)

      .input("CUSTOMERID", sql.NVarChar(100), customerId)

      .execute("A_SP_FOR_DASHBOARD_APP");

    res.json(result.recordset);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.post("/api/product-growth-details", async (req, res) => {
  try {
    const { databaseName, userId, period } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool
      .request()

      .input("WHAT", sql.NVarChar(100), "PRODUCT_GROWTH_DETAILS")

      .input("USERID", sql.NVarChar(100), userId)

      .input("PERIOD", sql.NVarChar(10), period)

      .execute("A_SP_FOR_DASHBOARD_APP");

    res.json(result.recordset);
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: err.message,
    });
  }
});

app.post("/api/category-best-month-customers", async (req, res) => {
  try {
    const { databaseName, userId, productId, year, month } = req.body;

    console.log("CATEGORY BEST MONTH REQUEST:", req.body);

    // VALIDATION
    if (!databaseName) {
      return res.status(400).json({
        success: false,
        message: "databaseName is required",
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "categoryName is required",
      });
    }

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: "Best month year and month are required",
      });
    }

    const pool = await getPool(databaseName);

    const result = await pool
      .request()

      .input("WHAT", sql.VarChar, "PRODUCT_BEST_MONTH_CUSTOMERS")

      .input("USERID", sql.NVarChar(100), userId)

      .input("PRODUCTID", sql.VarChar, productId)

      .input("BESTMONTHYEAR", sql.Int, parseInt(year))

      .input("BESTMONTHNO", sql.Int, parseInt(month))

      .execute("A_SP_FOR_DASHBOARD_APP");

    console.log("CATEGORY BEST MONTH CUSTOMERS:", result.recordset);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error("CATEGORY BEST MONTH CUSTOMER ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ============================================================
// ASSIGN TASK
// ============================================================

app.post("/api/assign-task", async (req, res) => {
  try {

    const {
      databaseName,
      taskTitle,
      taskDescription,
      assignedBy,
      assignedTo,
      startDate,
      dueDate,
      priority,
      status,
      propertyCode,
      assignedPropertyCode,
    } = req.body;


    // ========================================================
    // LOG REQUEST
    // ========================================================

    console.log("=================================");
    console.log("ASSIGN TASK API");
    console.log("databaseName =", databaseName);
    console.log("taskTitle =", taskTitle);
    console.log("taskDescription =", taskDescription);
    console.log("assignedBy =", assignedBy);
    console.log("assignedTo =", assignedTo);
    console.log("startDate =", startDate);
    console.log("dueDate =", dueDate);
    console.log("priority =", priority);
    console.log("status =", status);
    console.log("propertyCode =", propertyCode);
    console.log("assignedPropertyCode =", assignedPropertyCode);
    console.log("=================================");


    // ========================================================
    // VALIDATION
    // ========================================================

    if (!databaseName) {
      return res.status(400).json({
        success: false,
        message: "databaseName is required",
      });
    }

    if (!taskTitle || !taskTitle.trim()) {
      return res.status(400).json({
        success: false,
        message: "Task title is required",
      });
    }

    if (!assignedBy) {
      return res.status(400).json({
        success: false,
        message: "AssignedBy is required",
      });
    }

    if (!assignedTo) {
      return res.status(400).json({
        success: false,
        message: "AssignedTo is required",
      });
    }


    // ========================================================
    // DATE VALIDATION
    // ========================================================

    let parsedStartDate = null;
    let parsedDueDate = null;

    if (startDate) {

      parsedStartDate = String(startDate)
        .replace("T", " ")
        .substring(0, 19);

      if (
        !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(
          parsedStartDate
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid startDate",
        });
      }
    }


    if (dueDate) {

      parsedDueDate = String(dueDate)
        .replace("T", " ")
        .substring(0, 19);

      if (
        !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(
          parsedDueDate
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid dueDate",
        });
      }
    }


    // ========================================================
    // CHECK DATE ORDER
    // ========================================================

    if (
      parsedStartDate &&
      parsedDueDate &&
      parsedDueDate < parsedStartDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Due date cannot be before start date",
      });
    }


    // ========================================================
    // DATABASE CONNECTION
    // ========================================================

    const pool = await getPool(databaseName);


    // ========================================================
    // GENERATE TASK ID FIRST
    // ========================================================
    //
    // IMPORTANT:
    // Previously SQL was using NEWID() inside INSERT.
    //
    // Now we generate the ID here so that we can use the
    // SAME TaskId in APP_CHAT_TASK_PIN.
    //
    // ========================================================

    const taskId = require("crypto").randomUUID();

    console.log("GENERATED TASK ID =", taskId);


    // ========================================================
    // INSERT TASK
    // ========================================================

    const result = await pool
      .request()

      .input(
        "TaskId",
        sql.UniqueIdentifier,
        taskId
      )

      .input(
        "TaskTitle",
        sql.NVarChar(200),
        taskTitle.trim()
      )

      .input(
        "TaskDescription",
        sql.NVarChar(sql.MAX),
        taskDescription || null
      )

      .input(
        "AssignedBy",
        sql.NVarChar(100),
        assignedBy
      )

      .input(
        "AssignedTo",
        sql.NVarChar(100),
        assignedTo
      )

      .input(
        "StartDate",
        sql.NVarChar(19),
        parsedStartDate
      )

      .input(
        "DueDate",
        sql.NVarChar(19),
        parsedDueDate
      )

      .input(
        "Priority",
        sql.NVarChar(20),
        priority || "Medium"
      )

      .input(
        "Status",
        sql.NVarChar(20),
        status || "Pending"
      )

      .input(
        "DatabaseName",
        sql.NVarChar(100),
        databaseName
      )

      .input(
        "PropertyCode",
        sql.NVarChar(20),
        propertyCode || null
      )

      .input(
        "AssignedPropertyCode",
        sql.NVarChar(20),
        assignedPropertyCode || null
      )

      .query(`

        INSERT INTO MA_ChatTasks
        (
          TaskId,
          TaskTitle,
          TaskDescription,
          AssignedBy,
          AssignedTo,
          StartDate,
          DueDate,
          Priority,
          Status,
          CreatedDate,
          DatabaseName,
          PropertyCode,
          AssignedPropertyCode,
          IsRead
        )

        VALUES
        (
          @TaskId,
          @TaskTitle,
          @TaskDescription,
          @AssignedBy,
          @AssignedTo,

          CONVERT(datetime, @StartDate, 120),
          CONVERT(datetime, @DueDate, 120),

          @Priority,
          @Status,
          GETDATE(),
          @DatabaseName,
          @PropertyCode,
          @AssignedPropertyCode,

          0
        )

      `);


    console.log("TASK INSERTED SUCCESSFULLY");
    console.log("TASK ID =", taskId);
    console.log("INSERTED ROW COUNT =", result.rowsAffected);


    // ========================================================
    // GET ASSIGNEE LOGIN USER ID
    // ========================================================
    //
    // assignedTo is currently the employee UNQID.
    //
    // Chat uses SM63_5 (login/user ID).
    //
    // Therefore:
    //
    // assignedTo UNQID
    //       ↓
    // SM63.UNQID
    //       ↓
    // SM63_5
    //
    // ========================================================

    const assigneeResult = await pool
      .request()

      .input(
        "AssignedTo",
        sql.NVarChar(100),
        String(assignedTo)
      )

      .query(`

        SELECT TOP 1
          UNQID,
          SM63_5 AS UserID,
          SM63_6 AS UserName

        FROM SM63

        WHERE CONVERT(NVARCHAR(100), UNQID) = @AssignedTo

      `);


    const assignee = assigneeResult.recordset[0];


    if (!assignee) {

      console.log(
        "WARNING: ASSIGNEE NOT FOUND IN SM63"
      );

    } else {

      console.log(
        "ASSIGNEE USER ID =",
        assignee.UserID
      );

      console.log(
        "ASSIGNEE NAME =",
        assignee.UserName
      );


      // ======================================================
      // CREATE CHAT REFERENCE ID
      // ======================================================

      const chatUsers = [
        String(assignedBy),
        String(assignee.UserID),
      ].sort();

      const referenceId = chatUsers.join("_");


      console.log(
        "CHAT REFERENCE ID =",
        referenceId
      );


      // ======================================================
      // CREATE PINNED TASK TEXT
      // ======================================================

      const pinnedTaskText =
        `📌 Task: ${taskTitle.trim()}` +
        `${taskDescription && taskDescription.trim()
          ? `\n📝 ${taskDescription.trim()}`
          : ""}` +
        `${parsedDueDate
          ? `\n📅 Due: ${parsedDueDate}`
          : ""}` +
        `\n🔖 Status: ${status || "Pending"}` +
        `\n⚡ Priority: ${priority || "Medium"}`;


      console.log(
        "PINNED TASK TEXT =",
        pinnedTaskText
      );


      // ======================================================
      // AUTOMATICALLY PIN TASK IN CHAT
      // ======================================================

      await pool
        .request()

        .input(
          "REFERENCEID",
          sql.VarChar(255),
          referenceId
        )

        .input(
          "TASKID",
          sql.VarChar(100),
          taskId
        )

        .input(
          "TASKTEXT",
          sql.NVarChar(sql.MAX),
          pinnedTaskText
        )

        .input(
          "FROMUSER",
          sql.VarChar(100),
          String(assignedBy)
        )

        .input(
          "TOUSER",
          sql.VarChar(100),
          String(assignee.UserID)
        )

        .query(`

          IF EXISTS
          (
            SELECT 1

            FROM APP_CHAT_TASK_PIN

            WHERE REFERENCEID = @REFERENCEID
              AND TASKID = @TASKID
          )

          BEGIN

            UPDATE APP_CHAT_TASK_PIN

            SET
              TASKTEXT = @TASKTEXT,
              UPDATEDON = GETDATE()

            WHERE REFERENCEID = @REFERENCEID
              AND TASKID = @TASKID;

          END

          ELSE

          BEGIN

            INSERT INTO APP_CHAT_TASK_PIN
            (
              REFERENCEID,
              TASKID,
              TASKTEXT,
              FROMUSER,
              TOUSER,
              CREATEDON,
              UPDATEDON
            )

            VALUES
            (
              @REFERENCEID,
              @TASKID,
              @TASKTEXT,
              @FROMUSER,
              @TOUSER,
              GETDATE(),
              GETDATE()
            );

          END

        `);


      console.log(
        "================================="
      );

      console.log(
        "TASK AUTOMATICALLY PINNED IN CHAT"
      );

      console.log(
        "TASK ID =",
        taskId
      );

      console.log(
        "FROM USER =",
        assignedBy
      );

      console.log(
        "TO USER =",
        assignee.UserID
      );

      console.log(
        "REFERENCE ID =",
        referenceId
      );

      console.log(
        "================================="
      );
    }


    // ========================================================
    // SUCCESS
    // ========================================================

    return res.status(200).json({

      success: true,

      message: "Task assigned successfully",

      taskId: taskId,

    });


  } catch (err) {

    console.error(
      "================================="
    );

    console.error(
      "ASSIGN TASK ERROR =",
      err
    );

    console.error(
      "================================="
    );

    return res.status(500).json({

      success: false,

      message: err.message,

    });
  }
});
// ============================================================
// TASK DASHBOARD
// ============================================================

// ============================================================
// TASK DASHBOARD
// ============================================================

// ============================================================
// TASK DASHBOARD
// ============================================================

// ============================================================
// TASK DASHBOARD
// ============================================================

app.post("/api/task-dashboard", async (req, res) => {
  try {
    const { databaseName, userId, viewType = "All" } = req.body;

    console.log("=================================");
    console.log("TASK DASHBOARD API");
    console.log("databaseName =", databaseName);
    console.log("userId =", userId);
    console.log("viewType =", viewType);
    console.log("=================================");

    // ==========================================================
    // VALIDATION
    // ==========================================================

    if (!databaseName) {
      return res.status(400).json({
        success: false,
        message: "databaseName is required",
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    // ==========================================================
    // DATABASE CONNECTION
    // ==========================================================

    const pool = await getPool(databaseName);

    // ==========================================================
    // GET LOGGED-IN EMPLOYEE
    // ==========================================================

    const employeeResult = await pool
      .request()
      .input("UserId", sql.NVarChar(100), String(userId)).query(`
        SELECT TOP 1

          UNQID,

          SM63_5 AS UserId,

          SM63_6 AS UserName

        FROM SM63

        WHERE SM63_5 = @UserId
      `);

    const loggedInEmployee = employeeResult.recordset[0];

    console.log("LOGGED-IN EMPLOYEE =", loggedInEmployee);

    if (!loggedInEmployee) {
      return res.status(404).json({
        success: false,
        message: "Logged-in user not found in SM63",
      });
    }

    // ==========================================================
    // EMPLOYEE UNIQUE ID
    // ==========================================================

    const employeeUnqId = String(loggedInEmployee.UNQID);

    console.log("LOGGED-IN USER ID =", userId);

    console.log("LOGGED-IN EMPLOYEE UNQID =", employeeUnqId);

    console.log("LOGGED-IN USER NAME =", loggedInEmployee.UserName);

    // ==========================================================
    // WHERE CONDITION
    // ==========================================================

    let whereCondition = "";

    // ==========================================================
    // INDIVIDUAL
    // ==========================================================

    if (viewType === "Individual") {
      whereCondition = `
        WHERE
          T.AssignedTo = @EmployeeUnqId
      `;
    }

    // ==========================================================
    // GROUP
    // ==========================================================
    else if (viewType === "Group") {
      whereCondition = `
        WHERE
          T.AssignedBy = @UserId

          AND

          T.AssignedTo <> @EmployeeUnqId
      `;
    }

    // ==========================================================
    // ALL
    // ==========================================================
    else {
      whereCondition = `
        WHERE

          T.AssignedBy = @UserId

          OR

          T.AssignedTo = @EmployeeUnqId
      `;
    }

    console.log("WHERE CONDITION =", whereCondition);

    // ==========================================================
    // GET TASKS
    // ==========================================================

    const result = await pool
      .request()

      .input("UserId", sql.NVarChar(100), String(userId))

      .input("EmployeeUnqId", sql.NVarChar(100), employeeUnqId).query(`

        SELECT

          -- ==================================================
          -- TASK ID
          -- ==================================================

          T.TaskId,


          -- ==================================================
          -- TASK INFORMATION
          -- ==================================================

          T.TaskTitle,

          T.TaskDescription,


          -- ==================================================
          -- ASSIGNED BY
          -- ==================================================

          T.AssignedBy,

          ISNULL(
            AB.SM63_6,
            T.AssignedBy
          ) AS AssignedByName,


          -- ==================================================
          -- ASSIGNED TO
          -- ==================================================

          T.AssignedTo,

   T.AssignedTo,

ISNULL(
  AT.SM63_6,
  T.AssignedTo
) AS AssignedToName,

AT.SM63_5 AS AssignedToUserId,


          -- ==================================================
          -- DATES
          -- ==================================================

          T.StartDate,

          T.DueDate,


          -- ==================================================
          -- TASK STATUS
          -- ==================================================

          T.Priority,

          T.Status,

          T.CreatedDate,


          -- ==================================================
          -- READ STATUS
          -- ==================================================

          ISNULL(
            T.IsRead,
            0
          ) AS IsRead,


          -- ==================================================
          -- FINAL APPROVAL
          -- ==================================================

          T.FinalApprovalDateTime,

          T.FinalApprovedBy,


          -- ==================================================
          -- DATABASE
          -- ==================================================

          T.DatabaseName,


          -- ==================================================
          -- PROPERTY
          -- ==================================================

          T.PropertyCode,

          T.AssignedPropertyCode,


          -- ==================================================
          -- OVERDUE
          -- ==================================================

          CASE

            WHEN

              T.Status NOT IN (
                'Completed',
                'Cancelled'
              )

              AND

              T.DueDate IS NOT NULL

              AND

              CAST(T.DueDate AS DATE)
                < CAST(GETDATE() AS DATE)

            THEN 1

            ELSE 0

          END AS IsOverdue


        FROM MA_ChatTasks T


        -- ====================================================
        -- ASSIGNED BY
        -- ====================================================

        LEFT JOIN SM63 AB

          ON AB.SM63_5 = T.AssignedBy


        -- ====================================================
        -- ASSIGNED TO
        -- ====================================================

        LEFT JOIN SM63 AT

          ON CONVERT(
               NVARCHAR(100),
               AT.UNQID
             ) = T.AssignedTo


        -- ====================================================
        -- FILTER
        -- ====================================================

        ${whereCondition}


        -- ====================================================
        -- ORDER
        -- ====================================================

        ORDER BY

          CASE

            WHEN T.Status = 'Pending'
              THEN 1

            WHEN T.Status = 'In Progress'
              THEN 2

            WHEN T.Status = 'Completed'
              THEN 3

            WHEN T.Status = 'Cancelled'
              THEN 4

            ELSE 5

          END,

          T.DueDate ASC,

          T.CreatedDate DESC

      `);

    // ==========================================================
    // TASK DATA
    // ==========================================================

    const tasks = result.recordset;

    // ==========================================================
    // SUMMARY
    // ==========================================================

    const total = tasks.length;

    const pending = tasks.filter(
      (x) => String(x.Status).toLowerCase() === "pending",
    ).length;

    const inProgress = tasks.filter(
      (x) => String(x.Status).toLowerCase() === "in progress",
    ).length;

    const completed = tasks.filter(
      (x) => String(x.Status).toLowerCase() === "completed",
    ).length;

    const cancelled = tasks.filter(
      (x) => String(x.Status).toLowerCase() === "cancelled",
    ).length;

    const overdue = tasks.filter((x) => Number(x.IsOverdue) === 1).length;

    // ==========================================================
    // LOG
    // ==========================================================

    console.log("=================================");
    console.log("TASK DASHBOARD RESULT");

    console.log("USER ID =", userId);

    console.log("EMPLOYEE UNQID =", employeeUnqId);

    console.log("USER NAME =", loggedInEmployee.UserName);

    console.log("---------------------------------");

    console.log("TOTAL =", total);

    console.log("PENDING =", pending);

    console.log("IN PROGRESS =", inProgress);

    console.log("COMPLETED =", completed);

    console.log("CANCELLED =", cancelled);

    console.log("OVERDUE =", overdue);

    console.log("=================================");

    // ==========================================================
    // RESPONSE
    // ==========================================================

    return res.status(200).json({
      success: true,

      loggedInUser: {
        userId: userId,

        employeeUnqId: employeeUnqId,

        userName: loggedInEmployee.UserName,
      },

      summary: {
        total: total,

        pending: pending,

        inProgress: inProgress,

        completed: completed,

        cancelled: cancelled,

        overdue: overdue,
      },

      data: tasks,
    });
  } catch (err) {
    console.error("=================================");

    console.error("TASK DASHBOARD ERROR");

    console.error(err);

    console.error("=================================");

    return res.status(500).json({
      success: false,

      message: err.message,
    });
  }
});

// ============================================================
// UPDATE TASK STATUS
// ============================================================

app.post("/api/update-task-status", async (req, res) => {
  try {
    const { databaseName, taskId, status, changedBy } = req.body;

    console.log("=================================");
    console.log("UPDATE TASK STATUS");
    console.log("databaseName =", databaseName);
    console.log("taskId =", taskId);
    console.log("status =", status);
    console.log("changedBy =", changedBy);
    console.log("=================================");

    // ==========================================================
    // VALIDATION
    // ==========================================================

    if (!databaseName) {
      return res.status(400).json({
        success: false,
        message: "databaseName is required",
      });
    }

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: "taskId is required",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "status is required",
      });
    }

    // ==========================================================
    // ALLOWED STATUS
    // ==========================================================

    const allowedStatuses = [
      "Pending",
      "In Progress",
      "Completed",
      "Cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task status",
      });
    }

    // ==========================================================
    // DATABASE
    // ==========================================================

    const pool = await getPool(databaseName);

    // ==========================================================
    // GET TASK BEFORE UPDATE
    // ==========================================================

    const taskResult = await pool
      .request()

      .input("TaskId", sql.UniqueIdentifier, taskId).query(`

          SELECT TOP 1

            T.TaskId,

            T.TaskTitle,

            T.AssignedBy,

            T.AssignedTo,

            T.Status AS OldStatus,

            T.DatabaseName,

            ISNULL(
              AB.SM63_6,
              T.AssignedBy
            ) AS AssignedByName,

            ISNULL(
              AT.SM63_6,
              CAST(
                T.AssignedTo AS NVARCHAR(100)
              )
            ) AS AssignedToName

          FROM MA_ChatTasks T


          LEFT JOIN SM63 AB

            ON AB.SM63_5 = T.AssignedBy


          LEFT JOIN SM63 AT

            ON AT.UNQID = T.AssignedTo


          WHERE T.TaskId = @TaskId

        `);

    // ==========================================================
    // TASK NOT FOUND
    // ==========================================================

    if (taskResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const task = taskResult.recordset[0];

    const assignedBy = task.AssignedBy;

    const assignedTo = task.AssignedTo;

    const taskTitle = task.TaskTitle;

    const oldStatus = task.OldStatus;

    const assignedToName = task.AssignedToName;

    console.log("TASK FOUND");

    console.log("Assigned By =", assignedBy);

    console.log("Assigned To =", assignedTo);

    console.log("Task Title =", taskTitle);

    console.log("Old Status =", oldStatus);

    console.log("New Status =", status);

    // ==========================================================
    // NOTHING CHANGED
    // ==========================================================

    if (oldStatus === status) {
      return res.json({
        success: true,
        message: "Task status is already " + status,
      });
    }

    // ==========================================================
    // UPDATE TASK
    //
    // IMPORTANT:
    //
    // Status changes
    // IsRead changes to 1
    //
    // This stops the blink.
    // ==========================================================

    const updateResult = await pool
      .request()
      .input("TaskId", sql.UniqueIdentifier, taskId)
      .input("Status", sql.NVarChar(20), status).query(`
      UPDATE MA_ChatTasks
      SET
        Status = @Status,
        IsRead = 1
      WHERE TaskId = @TaskId
        AND FinalApprovalDateTime IS NULL
    `);

    // ==========================================================
    // UPDATE FAILED
    // ==========================================================

    if (updateResult.rowsAffected[0] === 0) {
      const lockCheck = await pool
        .request()
        .input("TaskId", sql.UniqueIdentifier, taskId).query(`
      SELECT
        FinalApprovalDateTime
      FROM MA_ChatTasks
      WHERE TaskId = @TaskId
    `);

      const finalApprovalDateTime =
        lockCheck.recordset[0]?.FinalApprovalDateTime;

      if (finalApprovalDateTime != null) {
        return res.status(400).json({
          success: false,
          locked: true,
          message: "Task is finally approved and locked.",
        });
      }

      return res.status(404).json({
        success: false,
        message: "Task update failed",
      });
    }

    console.log("TASK STATUS UPDATED");

    console.log("Status =", status);

    console.log("IsRead = 1");

    // ==========================================================
    // DO NOT NOTIFY USER IF SAME USER
    // ==========================================================

    if (assignedBy === changedBy) {
      return res.json({
        success: true,

        message: "Task status updated successfully",

        taskId: taskId,

        oldStatus: oldStatus,

        newStatus: status,
      });
    }

    // ==========================================================
    // NOTIFICATION MESSAGE
    // ==========================================================

    const notificationTitle = "Task Status Updated";

    const notificationMessage =
      `${assignedToName} changed "${taskTitle}" status ` +
      `from ${oldStatus} to ${status}.`;

    console.log("NOTIFICATION USER =", assignedBy);

    console.log("NOTIFICATION MESSAGE =", notificationMessage);

    // ==========================================================
    // SAVE NOTIFICATION
    // ==========================================================

    await pool
      .request()

      .input("USERID", sql.VarChar, assignedBy)

      .input("TITLE", sql.VarChar, notificationTitle)

      .input("MESSAGE", sql.NVarChar, notificationMessage)

      .input("REFERENCEID", sql.VarChar, taskId)

      .input("DATABASENAME", sql.VarChar, databaseName).query(`

        INSERT INTO APP_NOTIFICATION
        (
          USERID,
          TITLE,
          MESSAGE,
          REFERENCEID,
          DATABASENAME,
          ISREAD,
          CREATEDON
        )

        VALUES
        (
          @USERID,
          @TITLE,
          @MESSAGE,
          @REFERENCEID,
          @DATABASENAME,
          0,
          GETDATE()
        )

      `);

    console.log("APP NOTIFICATION SAVED");

    // ==========================================================
    // FCM PUSH NOTIFICATION
    // ==========================================================

    try {
      const companyPool = await getPool();

      const tokenResult = await companyPool
        .request()

        .input("userId", sql.VarChar, assignedBy).query(`

            SELECT DEVICETOKEN

            FROM APP_DEVICE_TOKEN

            WHERE USERID = @userId

          `);

      console.log("ASSIGNER DEVICE TOKENS =", tokenResult.recordset.length);

      for (const row of tokenResult.recordset) {
        if (row.DEVICETOKEN) {
          await sendNotification(
            row.DEVICETOKEN,

            notificationTitle,

            notificationMessage,

            {
              type: "TASK_STATUS",

              taskId: taskId,

              databaseName: databaseName,

              status: status,
            },
          );
        }
      }

      console.log("FCM TASK STATUS NOTIFICATION SENT");
    } catch (notificationError) {
      // Notification failure should
      // NOT make task update fail

      console.error("TASK FCM NOTIFICATION ERROR =", notificationError);
    }

    // ==========================================================
    // RESPONSE
    // ==========================================================

    return res.json({
      success: true,

      message: "Task status updated successfully",

      taskId: taskId,

      oldStatus: oldStatus,

      newStatus: status,

      isRead: 1,

      notifiedUser: assignedBy,
    });
  } catch (err) {
    console.error("=================================");

    console.error("UPDATE TASK STATUS ERROR =", err);

    console.error("=================================");

    return res.status(500).json({
      success: false,

      message: err.message,
    });
  }
});
// ============================================================
// FINAL TASK APPROVAL
// Only the person who assigned the task can approve it
// ============================================================

app.post("/api/approve-task", async (req, res) => {
  try {
    const { databaseName, taskId, approvedBy } = req.body;

    console.log("=================================");
    console.log("FINAL TASK APPROVAL");
    console.log("databaseName =", databaseName);
    console.log("taskId =", taskId);
    console.log("approvedBy =", approvedBy);
    console.log("=================================");

    // ========================================================
    // VALIDATION
    // ========================================================

    if (!databaseName) {
      return res.status(400).json({
        success: false,
        message: "databaseName is required",
      });
    }

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: "taskId is required",
      });
    }

    if (!approvedBy) {
      return res.status(400).json({
        success: false,
        message: "approvedBy is required",
      });
    }

    // ========================================================
    // DATABASE CONNECTION
    // ========================================================

    const pool = await getPool(databaseName);

    // ========================================================
    // GET TASK
    // ========================================================

    const taskResult = await pool
      .request()
      .input("TaskId", sql.UniqueIdentifier, taskId).query(`
        SELECT TOP 1
            TaskId,
            TaskTitle,
            AssignedBy,
            AssignedTo,
            Status
        FROM MA_ChatTasks
        WHERE TaskId = @TaskId
      `);

    // ========================================================
    // TASK NOT FOUND
    // ========================================================

    if (taskResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const task = taskResult.recordset[0];

    console.log("TASK FOUND");
    console.log("AssignedBy =", task.AssignedBy);
    console.log("AssignedTo =", task.AssignedTo);
    console.log("Status =", task.Status);

    // ========================================================
    // ONLY ASSIGNER CAN APPROVE
    // ========================================================

    if (String(task.AssignedBy).trim() !== String(approvedBy).trim()) {
      return res.status(403).json({
        success: false,
        message: "Only the person who assigned the task can approve it",
      });
    }

    // ========================================================
    // TASK MUST BE COMPLETED
    // ========================================================

    if (String(task.Status).trim().toLowerCase() !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Task must be Completed before final approval",
      });
    }

    // ========================================================
    // CHECK IF ALREADY APPROVED
    // ========================================================

    const alreadyApproved = await pool
      .request()
      .input("TaskId", sql.UniqueIdentifier, taskId).query(`
        SELECT
            FinalApprovalDateTime,
            FinalApprovedBy
        FROM MA_ChatTasks
        WHERE TaskId = @TaskId
      `);

    const approvalData = alreadyApproved.recordset[0];

    if (approvalData.FinalApprovalDateTime != null) {
      return res.status(400).json({
        success: false,
        message: "Task has already been finally approved",
      });
    }

    // ========================================================
    // SAVE FINAL APPROVAL
    // ========================================================

    const updateResult = await pool
      .request()
      .input("TaskId", sql.UniqueIdentifier, taskId)
      .input("FinalApprovedBy", sql.NVarChar(100), approvedBy).query(`
        UPDATE MA_ChatTasks
        SET
            FinalApprovalDateTime = GETDATE(),
            FinalApprovedBy = @FinalApprovedBy
        WHERE TaskId = @TaskId
      `);

    // ========================================================
    // CHECK UPDATE
    // ========================================================

    if (updateResult.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: "Final approval could not be saved",
      });
    }

    // ========================================================
    // SUCCESS
    // ========================================================

    console.log("FINAL APPROVAL SAVED");
    console.log("TaskId =", taskId);
    console.log("ApprovedBy =", approvedBy);

    return res.json({
      success: true,
      message: "Task finally approved successfully",
      taskId: taskId,
      approvedBy: approvedBy,
    });
  } catch (err) {
    console.error("=================================");
    console.error("FINAL APPROVAL ERROR");
    console.error(err);
    console.error("=================================");

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ============================================================

app.post("/api/task-request-count", async (req, res) => {
  try {
    const { databaseName, userId } = req.body;

    console.log("=================================");
    console.log("TASK REQUEST COUNT API");
    console.log("databaseName =", databaseName);
    console.log("userId =", userId);
    console.log("=================================");

    // ==========================================================
    // VALIDATION
    // ==========================================================

    if (!databaseName) {
      return res.status(400).json({
        success: false,
        message: "databaseName is required",
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    // ==========================================================
    // DATABASE CONNECTION
    // ==========================================================

    const pool = await getPool(databaseName);

    // ==========================================================
    // FIND LOGGED-IN EMPLOYEE
    // ==========================================================

    const employeeResult = await pool
      .request()
      .input("UserId", sql.NVarChar(100), String(userId)).query(`
        SELECT TOP 1

          UNQID,

          SM63_5 AS UserId,

          SM63_6 AS UserName

        FROM SM63

        WHERE SM63_5 = @UserId
      `);

    const employee = employeeResult.recordset[0];

    // ==========================================================
    // USER NOT FOUND
    // ==========================================================

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "User not found in SM63",
      });
    }

    // ==========================================================
    // IMPORTANT
    //
    // SM63.UNQID = uniqueidentifier
    // MA_ChatTasks.AssignedTo = nvarchar
    //
    // Convert employee UNQID to string.
    // ==========================================================

    const employeeUnqId = String(employee.UNQID);

    console.log("USER ID =", userId);

    console.log("EMPLOYEE UNQID =", employeeUnqId);

    console.log("USER NAME =", employee.UserName);

    // ==========================================================
    // GET UNREAD PENDING TASK COUNT
    // ==========================================================

    const result = await pool
      .request()

      // IMPORTANT:
      // AssignedTo is NVARCHAR
      .input("EmployeeUnqId", sql.NVarChar(100), employeeUnqId).query(`
        SELECT
          COUNT(*) AS TaskRequestCount

        FROM MA_ChatTasks

        WHERE
          AssignedTo = @EmployeeUnqId

          AND Status = 'Pending'

          AND ISNULL(IsRead, 0) = 0
      `);

    // ==========================================================
    // GET COUNT
    // ==========================================================

    const row = result.recordset[0];

    const count = Number(row?.TaskRequestCount) || 0;

    // ==========================================================
    // LOG
    // ==========================================================

    console.log("UNREAD TASK REQUEST COUNT =", count);

    // ==========================================================
    // RESPONSE
    // ==========================================================

    return res.status(200).json({
      success: true,

      count: count,

      user: {
        userId: userId,

        employeeUnqId: employeeUnqId,

        userName: employee.UserName,
      },
    });
  } catch (err) {
    console.error("=================================");
    console.error("TASK REQUEST COUNT ERROR");
    console.error(err);
    console.error("=================================");

    return res.status(500).json({
      success: false,

      message: err.message,
    });
  }
});
// ============================================================
// MARK TASK REQUESTS AS READ
// ============================================================

app.post("/api/task-request-read", async (req, res) => {
  try {
    const { databaseName, userId } = req.body;

    console.log("=================================");
    console.log("MARK TASK REQUESTS AS READ");
    console.log("databaseName =", databaseName);
    console.log("userId =", userId);
    console.log("=================================");

    // ==========================================================
    // VALIDATION
    // ==========================================================

    if (!databaseName) {
      return res.status(400).json({
        success: false,
        message: "databaseName is required",
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    // ==========================================================
    // DATABASE CONNECTION
    // ==========================================================

    const pool = await getPool(databaseName);

    // ==========================================================
    // GET LOGGED-IN EMPLOYEE UNQID
    //
    // SM63.UNQID = uniqueidentifier
    // ==========================================================

    const employeeResult = await pool
      .request()
      .input("UserId", sql.NVarChar(100), String(userId)).query(`
        SELECT TOP 1
          UNQID,
          SM63_5 AS UserId,
          SM63_6 AS UserName
        FROM SM63
        WHERE SM63_5 = @UserId
      `);

    const employee = employeeResult.recordset[0];

    // ==========================================================
    // USER NOT FOUND
    // ==========================================================

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "User not found in SM63",
      });
    }

    // ==========================================================
    // CONVERT UNQID TO STRING
    //
    // MA_ChatTasks.AssignedTo = NVARCHAR
    // ==========================================================

    const employeeUnqId = String(employee.UNQID);

    console.log("EMPLOYEE UNQID =", employeeUnqId);

    console.log("EMPLOYEE NAME =", employee.UserName);

    // ==========================================================
    // MARK UNREAD PENDING TASKS AS READ
    //
    // AssignedTo is NVARCHAR
    // Therefore parameter must also be NVARCHAR.
    // ==========================================================

    const result = await pool
      .request()
      .input("EmployeeUnqId", sql.NVarChar(100), employeeUnqId).query(`
        UPDATE MA_ChatTasks

        SET
          IsRead = 1

        WHERE
          AssignedTo = @EmployeeUnqId

          AND Status = 'Pending'

          AND ISNULL(IsRead, 0) = 0
      `);

    // ==========================================================
    // LOG
    // ==========================================================

    const markedRead = result.rowsAffected[0] || 0;

    console.log("TASKS MARKED READ =", markedRead);

    console.log("=================================");

    // ==========================================================
    // RESPONSE
    // ==========================================================

    return res.json({
      success: true,

      markedRead: markedRead,

      user: {
        userId: String(userId),
        employeeUnqId: employeeUnqId,
        userName: employee.UserName,
      },
    });
  } catch (err) {
    console.error("=================================");
    console.error("MARK TASK READ ERROR");
    console.error(err);
    console.error("=================================");

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});
// ============================================================
// MARK TASK REQUESTS AS READ
// ============================================================

const dashboardRoutes = require("./routes/dashboard");
app.use("/api", dashboardRoutes);

const ai_assistant = require("./routes/ai_assistant");
app.use("/api", ai_assistant);

const admin_dashboard = require("./routes/admin_dashboard");
app.use("/api", admin_dashboard);

const callservice = require("./routes/callservice");
app.use("/api", callservice);

const enquiry = require("./routes/enquiry");
app.use("/api", enquiry);

const freightenq = require("./routes/freightenq");
app.use("/api", freightenq);

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
