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

    console.log("DATABASE RECEIVED =", databaseName);

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

router.post("/customer-risk-score", async (req, res) => {
  try {

    const { databaseName, customerId } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool.request()
      .input("WHAT", sql.VarChar, "CUSTOMER_RISK_SCORE")
      .input("CustomerID", sql.VarChar, customerId)
      .execute("A_SP_FOR_SRL_APP");

    res.json({
      success: true,
      data: result.recordset,
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });

  }
});

router.post("/customer-due-bills", async (req, res) => {
    try {

        const { databaseName, customerId } = req.body;

        if (!databaseName || !customerId) {
            return res.status(400).json({
                success: false,
                message: "databaseName and customerId are required."
            });
        }

        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input("WHAT", sql.VarChar, "CUSTOMER_DUE_BILLS")
            .input("CustomerID", sql.VarChar, customerId)
            .execute("A_SP_FOR_SRL_APP");

        res.json({
            success: true,
            data: result.recordset
        });

    } catch (err) {

        console.error("Customer Due Bills Error:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

router.post("/customer-due-bills_dashboard", async (req, res) => {
  try {
    const { databaseName, customerUnq } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool.request()
      .input("WHAT", sql.VarChar, "CUSTOMER_DUE_BILLS")
      .input("CUSTOMERUNQ", sql.VarChar, customerUnq)
      .execute("A_SP_FOR_DASHBOARD_APP");

    res.json({
      success: true,
      data: result.recordset,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.post("/collection-history", async (req, res) => {
  try {
    const {
      databaseName,
      userId,
      customerunq
    } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool.request()
      .input("WHAT", sql.VarChar, "COLLECTION_HISTORY")
      .input("CUSTOMERUNQ", sql.VarChar, customerunq)
      .execute("A_SP_FOR_DASHBOARD_APP");

    res.json(result.recordset);

  } catch (error) {
    console.error("COLLECTION HISTORY ERROR:", error);

    res.status(500).json({
      error: "Failed to fetch collection history"
    });
  }
});

// ============================================================
// DASHBOARD CHALLAN REPORT
// Loads only when user clicks Challans card
// ============================================================

router.post("/dashboard-challans", async (req, res) => {
  try {
    const {
      databaseName,
      userId
    } = req.body;

    console.log("======================================");
    console.log("DASHBOARD CHALLAN / ORDER BOOKING REQUEST");
    console.log("DATABASE =", databaseName);
    console.log("USER ID  =", userId);
    console.log("======================================");

    // ---------------------------------------------------------
    // VALIDATION
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // GET DATABASE POOL
    // ---------------------------------------------------------

    const pool = await getPool(databaseName);

    // ---------------------------------------------------------
    // EXECUTE DASHBOARD SP
    // ---------------------------------------------------------

    const result = await pool
      .request()

      .input(
        "WHAT",
        sql.NVarChar(100),
        "DASHBOARD_CHALLAN_REPORT"
      )

      .input(
        "USERID",
        sql.NVarChar(100),
        userId
      )

      .execute("A_SP_FOR_DASHBOARD_APP");

    // ---------------------------------------------------------
    // TWO RESULT SETS
    // ---------------------------------------------------------

    const challans =
      result.recordsets?.[0] ?? [];

    const orderBookings =
      result.recordsets?.[1] ?? [];

    // ---------------------------------------------------------
    // LOG RESULT
    // ---------------------------------------------------------

    console.log(
      "======================================"
    );

    console.log(
      "CHALLAN COUNT =",
      challans.length
    );

    console.log(
      "ORDER BOOKING COUNT =",
      orderBookings.length
    );

    console.log(
      "TOTAL RESULT SETS =",
      result.recordsets?.length ?? 0
    );

    console.log(
      "======================================"
    );

    // Optional debugging
    console.log(
      "FIRST CHALLAN =",
      challans[0]
    );

    console.log(
      "FIRST ORDER BOOKING =",
      orderBookings[0]
    );

    // ---------------------------------------------------------
    // RESPONSE
    // ---------------------------------------------------------

    return res.status(200).json({
      success: true,

      data: {
        challans: challans,
        orderBookings: orderBookings,
      },
    });

  } catch (error) {

    console.error(
      "======================================"
    );

    console.error(
      "DASHBOARD CHALLAN / ORDER BOOKING ERROR:",
      error
    );

    console.error(
      "======================================"
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ============================================================
// INVENTORY MANAGEMENT - USER WISE WAREHOUSES
// ============================================================

router.post("/inventory-warehouses", async (req, res) => {
  try {
    const {
      databaseName,
      userId
    } = req.body;

    console.log("======================================");
    console.log("INVENTORY WAREHOUSE REQUEST");
    console.log("Database:", databaseName);
    console.log("User ID:", userId);
    console.log("======================================");

    // Validation
    if (!databaseName) {
      return res.status(400).json({
        success: false,
        message: "databaseName is required"
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required"
      });
    }

    const pool = await getPool(databaseName);

    // Call stored procedure
    const result = await pool
      .request()
      .input(
        "WHAT",
        sql.NVarChar(50),
        "IMS_MOBILE_WAREHOUSE"
      )
      .input(
        "userid",
        sql.NVarChar(50),
        userId
      )
      .execute("A_SP_FOR_IMS_REPORT");

    console.log(
      "INVENTORY WAREHOUSES:",
      result.recordset
    );

    res.json({
      success: true,
      data: result.recordset
    });

  } catch (err) {

    console.error(
      "INVENTORY WAREHOUSE ERROR:",
      err
    );

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});


// ============================================================
// INVENTORY MANAGEMENT - SELECTED WAREHOUSE
// ============================================================

router.post("/inventory-management", async (req, res) => {
  try {
    const {
      databaseName,
      userId,
      warehouse
    } = req.body;

    console.log("======================================");
    console.log("INVENTORY MANAGEMENT REQUEST");
    console.log("Database:", databaseName);
    console.log("User ID:", userId);
    console.log("Warehouse:", warehouse);
    console.log("======================================");

    // Validation
    if (!databaseName) {
      return res.status(400).json({
        success: false,
        message: "databaseName is required"
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required"
      });
    }

    if (!warehouse) {
      return res.status(400).json({
        success: false,
        message: "warehouse is required"
      });
    }

    const pool = await getPool(databaseName);

    // Call stored procedure
    const result = await pool
      .request()
      .input(
        "WHAT",
        sql.NVarChar(50),
        "IMS_MOBILE"
      )
      .input(
        "WAREHOUSE",
        sql.NVarChar(200),
        warehouse
      )
      .input(
        "userid",
        sql.NVarChar(50),
        userId
      )
      .execute("A_SP_FOR_IMS_REPORT");

    console.log(
      "INVENTORY DATA:",
      result.recordset
    );

    res.json({
      success: true,
      data: result.recordset
    });

  } catch (err) {

    console.error(
      "INVENTORY MANAGEMENT ERROR:",
      err
    );

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});


module.exports = router;