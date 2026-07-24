const express = require("express");
const router = express.Router();

const sql = require("mssql");
const { getPool } = require("../config/db");
router.post("/sales-dashboard", async (req, res) => {

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
        "WHAT",
        sql.VarChar,
        "SALES"
      )

      .input(
        "USERID",
        sql.VarChar,
        userId
      )

      .execute(
        "A_SP_FOR_DASHBOARD_APP"
      );

    res.json({

  success: true,

  MTDSALES:
      result.recordsets[0][0]
          ?.MTDSALES ?? 0,
           
  TODAYSALES:
      result.recordsets[1][0]
          ?.TODAYSALES ?? 0,

  TOTALCHALLANS:
      result.recordsets[2][0]
          ?.TOTALCHALLANS ?? 0,

  CUSTOMERS:
      result.recordsets[3][0]
          ?.CUSTOMERS ?? 0,

 
  // ========================================
// MONTH
// ========================================

CURRENTMTD:
    result.recordsets[5]?.[0]?.CurrentMTD ?? 0,

LASTMTD:
    result.recordsets[5]?.[0]?.LastMTD ?? 0,

MTDGROWTHPERCENT:
    result.recordsets[5]?.[0]?.MTDGrowthPercent ?? 0,


// ========================================
// QUARTER
// ========================================

CURRENTQTD:
    result.recordsets[5]?.[0]?.CurrentQTD ?? 0,

LASTQTD:
    result.recordsets[5]?.[0]?.LastQTD ?? 0,

QTDGROWTHPERCENT:
    result.recordsets[5]?.[0]?.QTDGrowthPercent ?? 0,

QUARTERNO:
    result.recordsets[5]?.[0]?.QuarterNo ?? 0,

CURRENTQUARTERSTART:
    result.recordsets[5]?.[0]?.CurrentQuarterStart ?? null,

CURRENTQUARTEREND:
    result.recordsets[5]?.[0]?.CurrentQuarterEnd ?? null,

PREVIOUSQUARTERSTART:
    result.recordsets[5]?.[0]?.PreviousQuarterStart ?? null,

PREVIOUSQUARTEREND:
    result.recordsets[5]?.[0]?.PreviousQuarterEnd ?? null,


// ========================================
// FINANCIAL YEAR
// ========================================

CURRENTYTD:
    result.recordsets[5]?.[0]?.CurrentYTD ?? 0,

LASTYTD:
    result.recordsets[5]?.[0]?.LastYTD ?? 0,

YTDGROWTHPERCENT:
    result.recordsets[5]?.[0]?.YTDGrowthPercent ?? 0,

  MONTHLYTREND:
      result.recordsets[4] ?? [],

      DUEAMOUNT:
      result.recordsets[6]?.[0]?.DUEAMOUNT ?? 0,

      TOPDUECUSTOMERS: result.recordsets[7] ?? [],

      TODAYSALESLIST: result.recordsets[8] ?? [],
      
      //weeklyTrend : result.recordsets[9]?? [],

      TOPDUECUSTOMERSBYDUEDAYS: result.recordsets[9] ?? [],

      CurrentQty: result.recordsets[11][0]?.CurrentQty ?? 0,
      avgLast3MonthsQty:result.recordsets[11][0]?.avgLast3MonthsQty ?? 0,
      TargetQty: result.recordsets[11][0]?.TargetQty ?? 0,
      RemainingQty: result.recordsets[11][0]?.RemainingQty ?? 0,
      ExcessQty: result.recordsets[11][0]?.ExcessQty ?? 0,
      AchievementPercent: result.recordsets[11][0]?.AchievementPercent ?? 0,
      //MonthlyTarget: result.recordsets[11][0]?.MonthlyTarget ?? 0,
     // MTDTarget: result.recordsets[11][0]?.MTDTarget ?? 0,

});

  } catch (err) {

    console.log(err);

    res.status(500).json({

      success: false,

      message: err.message,
    });
  }
});
router.post("/top-growing-products", async (req, res) => {

  const { databaseName, userId } = req.body;

  try {

    const pool = await getPool(databaseName);

    const result = await pool.request()

      .input("WHAT", sql.VarChar, "TOP_GROWING_PRODUCTS")

      .input("USERID", sql.VarChar, userId)

      .execute("A_SP_FOR_DASHBOARD_APP");

    res.json(result.recordset);

  } catch (err) {

    console.error(err);

    res.status(500).json(err.message);

  }

});

router.post('/customer-health-details', async (req, res) => {

  try {
    console.log("Customer Health Route Hit");

    const { databaseName, userId, type } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool.request()

      .input('WHAT', sql.NVarChar(100), 'CUSTOMER_HEALTH_DETAILS')
      .input('USERID', sql.NVarChar(100), userId)
      .input('TYPE', sql.NVarChar(50), type)

      .execute('A_SP_FOR_DASHBOARD_APP');

    res.json(result.recordset);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });

  }

});

router.post("/top-growing-customers", async (req, res) => {

  const { databaseName, userId } = req.body;

  try {

    const pool = await getPool(databaseName);

    const result = await pool.request()
      .input("WHAT", sql.VarChar, "TOP_GROWING_CUSTOMERS")
      .input("USERID", sql.VarChar, userId)
      .execute("A_SP_FOR_DASHBOARD_APP");

    res.json(result.recordset);

  } catch (err) {

    console.error(err);

    res.status(500).json({ error: err.message });

  }

});

router.post("/top-growing-customer-products", async (req, res) => {

    const { databaseName, userId, customerId } = req.body;

    try {

        const pool = await getPool(databaseName);

        const result = await pool.request()

            .input("WHAT", sql.VarChar, "TOP_GROWING_CUSTOMER_PRODUCTS")

            .input("USERID", sql.VarChar, userId)

            .input("CUSTOMERID", sql.VarChar, customerId)

            .execute("A_SP_FOR_DASHBOARD_APP");

        res.json(result.recordset);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});

router.post("/product-customer-insight", async (req, res) => {
  try {
    const {
      databaseName,
      userId,
      customerId,
      productId,
      bestMonthYear,
      bestMonthNo,
    } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool
      .request()
      .input("WHAT", sql.VarChar(100), "PRODUCT_CUSTOMER_INSIGHT")
      .input("USERID", sql.VarChar(50), userId)
      .input("CUSTOMERID", sql.VarChar(50), customerId)
      .input("PRODUCTID", sql.VarChar(50), productId)
      .input("BESTMONTHYEAR", sql.Int, bestMonthYear)
      .input("BESTMONTHNO", sql.Int, bestMonthNo)
      .execute("A_SP_FOR_DASHBOARD_APP");

    console.log(result.recordsets);

    res.json(result.recordsets);
  } catch (err) {
    console.error("PRODUCT CUSTOMER INSIGHT ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.post("/customer-product-trend", async (req, res) => {

  try {

    const {
      databaseName,
      userId,
      customerId,
      productId,
      what,              // <-- Add this
    } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool.request()

      .input("WHAT", sql.VarChar(100), what)   // <-- Use request value

      .input("USERID", sql.VarChar(50), userId)

      .input("CUSTOMERID", sql.VarChar(50), customerId)

      .input("PRODUCTID", sql.VarChar(50), productId)

      .execute("A_SP_FOR_DASHBOARD_APP");

    res.json(result.recordset);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: err.message,
    });

  }

});

router.post("/product-customer-analysis", async (req, res) => {

  try {

    const {
      databaseName,
      userId,
      productId,
    } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool.request()

      .input("WHAT", sql.VarChar(100), "PRODUCT_CUSTOMER_ANALYSIS")

      .input("USERID", sql.VarChar(50), userId)

      .input("PRODUCTID", sql.VarChar(50), productId)

      .execute("A_SP_FOR_DASHBOARD_APP");

    res.json(result.recordset);

  } catch (err) {

    console.error("PRODUCT CUSTOMER ANALYSIS :", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });

  }

});
module.exports = router;