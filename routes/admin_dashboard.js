const express = require("express");
const router = express.Router();

const sql = require("mssql");
const { getPool } = require("../config/db");

router.post("/director-dashboard", async (req, res) => {
    try {

        const { databaseName } = req.body;

        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input("WHAT", sql.VarChar, "DIRECTOR_DASHBOARD")
            .execute("A_SP_FOR_DASHBOARD_ADMIN");

        res.json(result.recordsets);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post("/director-sales-team", async (req, res) => {
    try {
        const { databaseName } = req.body;

        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input(
                "WHAT",
                sql.VarChar,
                "DIRECTOR_SALES_TEAM"
            )
            .execute("A_SP_FOR_DASHBOARD_ADMIN");

        res.json(result.recordsets);

    } catch (err) {

        console.error(
            "DIRECTOR SALES TEAM ERROR:",
            err
        );

        res.status(500).json({
            error: err.message
        });
    }
});

router.post("/manufacturerwise-purchase", async (req, res) => {
    try {

        const {
            databaseName,
            period = "MONTH"
        } = req.body;


        const pool = await getPool(databaseName);


        const result = await pool.request()

            .input(
                "WHAT",
                sql.NVarChar(200),
                "MANUFACTURERWISE_PURCHASE"
            )

            .input(
                "PERIOD",
                sql.NVarChar(20),
                period
            )

            .execute("A_SP_FOR_DASHBOARD_ADMIN");


        res.json(result.recordset);


    } catch (error) {

        console.error(
            "Manufacturer purchase error:",
            error
        );


        res.status(500).json({
            success: false,
            message: "Failed to load manufacturer purchase"
        });

    }
});

router.post("/product-direct-customers", async (req, res) => {
    try {

        const {
            databaseName,
            productId,
            period
        } = req.body;

        const pool = await getPool(databaseName);

        const result = await pool.request()

            .input(
                "WHAT",
                sql.NVarChar(200),
                "PRODUCT_DIRECT_CUSTOMERS"
            )

            .input(
                "PRODUCTID",
                sql.NVarChar(100),
                productId
            )

            .input(
                "PERIOD",
                sql.NVarChar(20),
                period || "CURRENT"
            )

            .execute(
                "A_SP_FOR_DASHBOARD_ADMIN"
            );

        res.json(result.recordset);

    } catch (error) {

        console.error(
            "Product direct customers error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to load direct customers"
        });
    }
});

// ============================================================
// SALES ANALYSIS
// ============================================================

router.post("/sales-analysis", async (req, res) => {

  try {

    const {
      databaseName,
      userId,
      period,
      fromDate,
      toDate,
       topProductsOffset = 0,
       topProductsLimit = 5,

  topCustomersOffset = 0,
  topCustomersLimit = 5,

  salespersonOffset = 0,
  salespersonLimit = 5
    } = req.body;


    console.log("=================================");
    console.log("SALES ANALYSIS");
    console.log("DATABASE =", databaseName);
    console.log("USER ID  =", userId);
    console.log("PERIOD   =", period);
    console.log("FROM     =", fromDate);
    console.log("TO       =", toDate);
    console.log("=================================");


    // ============================================================
    // VALIDATION
    // ============================================================

    if (!databaseName) {

      return res.status(400).json({
        success: false,
        message: "databaseName is required"
      });

    }


    // ============================================================
    // GET DATABASE POOL
    // ============================================================

    const pool = await getPool(databaseName);


    // ============================================================
    // COMMON STORED PROCEDURE EXECUTOR
    // ============================================================

   const executeSalesAnalysis = async (
  what,
  offset = 0,
  limit = 5
) => {

  console.log(
    `Executing A_SP_FOR_SALES_ANALYSIS -> ${what}`
  );

  console.log(
    `OFFSET = ${offset}, LIMIT = ${limit}`
  );

  const request = pool.request()

    .input(
      "WHAT",
      sql.NVarChar(50),
      what
    )

    .input(
      "USERID",
      sql.NVarChar(100),
      userId || ""
    )

    .input(
      "PERIOD",
      sql.NVarChar(20),
      period || "MONTH"
    )

    .input(
      "FROMDATE",
      sql.Date,
      fromDate || null
    )

    .input(
      "TODATE",
      sql.Date,
      toDate || null
    )

    .input(
      "OFFSET",
      sql.Int,
      Number(offset) || 0
    )

    .input(
      "LIMIT",
      sql.Int,
      Number(limit) || 5
    );

  const result =
    await request.execute(
      "A_SP_FOR_SALES_ANALYSIS"
    );

  console.log(
    `${what} -> ${result.recordset?.length || 0} rows`
  );

  return result.recordset || [];
};

    // ============================================================
    // 1. SUMMARY
    // ============================================================

    const summary =
      await executeSalesAnalysis(
        "SUMMARY"
      );


    // ============================================================
    // 2. SALES TREND
    // ============================================================

    const salesTrend =
      await executeSalesAnalysis(
        "SALES_TREND"
      );


    // ============================================================
    // 3. CATEGORY SALES
    // ============================================================

    const categorySales =
      await executeSalesAnalysis(
        "CATEGORY_SALES"
      );


    // ============================================================
    // 4. TOP PRODUCTS
    // ============================================================

  const topProducts =
  await executeSalesAnalysis(
    "TOP_PRODUCTS",
    topProductsOffset,
    topProductsLimit
  );

    // ============================================================
    // 5. TOP CUSTOMERS
    // ============================================================

const topCustomers =
  await executeSalesAnalysis(
    "TOP_CUSTOMERS",
    topCustomersOffset,
    topCustomersLimit
  );

    // ============================================================
    // 6. SALESPERSON SALES
    // ============================================================

   const salespersonSales =
  await executeSalesAnalysis(
    "SALESPERSON_SALES",
    salespersonOffset,
    salespersonLimit
  );


    // ============================================================
    // 7. BRANCH SALES
    // ============================================================

    const branchSales =
      await executeSalesAnalysis(
        "BRANCH_SALES"
      );


    // ============================================================
    // FINAL RESPONSE
    // ============================================================

    return res.json({

      success: true,

      summary:
        summary.length > 0
          ? summary[0]
          : {},

      salesTrend:
        salesTrend,

      categorySales:
        categorySales,

      topProducts:
        topProducts,

      topCustomers:
        topCustomers,

      salespersonSales:
        salespersonSales,

      branchSales:
        branchSales

    });

  }


  catch (err) {

    console.error(
      "================================="
    );

    console.error(
      "SALES ANALYSIS ERROR"
    );

    console.error(
      err
    );

    console.error(
      "================================="
    );


    return res.status(500).json({

      success: false,

      message:
        err.message ||
        "Failed to load sales analysis"

    });

  }

});

// ============================================================
// PAGED SALES ANALYSIS
// Used by Show More buttons
// ============================================================

router.post("/sales-analysis/paged", async (req, res) => {
  try {

    const {
      databaseName,
      userId,
      period,
      fromDate,
      toDate,
      what,
      offset = 0,
      limit = 5
    } = req.body;


    console.log("=================================");
    console.log("PAGED SALES ANALYSIS");
    console.log("DATABASE =", databaseName);
    console.log("USER ID  =", userId);
    console.log("PERIOD   =", period);
    console.log("WHAT     =", what);
    console.log("OFFSET   =", offset);
    console.log("LIMIT    =", limit);
    console.log("FROM     =", fromDate);
    console.log("TO       =", toDate);
    console.log("=================================");


    // ============================================================
    // VALIDATION
    // ============================================================

    if (!databaseName) {
      return res.status(400).json({
        success: false,
        message: "databaseName is required"
      });
    }


    if (!what) {
      return res.status(400).json({
        success: false,
        message: "what is required"
      });
    }


    // Only allow these three paginated sections
    const allowedWhat = [
      "TOP_PRODUCTS",
      "TOP_CUSTOMERS",
      "SALESPERSON_SALES"
    ];


    if (!allowedWhat.includes(what)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sales analysis section"
      });
    }


    // ============================================================
    // GET DATABASE POOL
    // ============================================================

    const pool = await getPool(databaseName);


    // ============================================================
    // SAFE PAGINATION VALUES
    // ============================================================

    const safeOffset =
      Math.max(0, Number(offset) || 0);

    const safeLimit =
      Math.max(1, Number(limit) || 5);


    console.log(
      `Executing A_SP_FOR_SALES_ANALYSIS -> ${what}`
    );

    console.log(
      `OFFSET = ${safeOffset}, LIMIT = ${safeLimit}`
    );


    // ============================================================
    // EXECUTE ONLY REQUESTED SECTION
    // ============================================================

    const request = pool.request()

      .input(
        "WHAT",
        sql.NVarChar(50),
        what
      )

      .input(
        "USERID",
        sql.NVarChar(100),
        userId || ""
      )

      .input(
        "PERIOD",
        sql.NVarChar(20),
        period || "MONTH"
      )

      .input(
        "FROMDATE",
        sql.Date,
        fromDate || null
      )

      .input(
        "TODATE",
        sql.Date,
        toDate || null
      )

      .input(
        "OFFSET",
        sql.Int,
        safeOffset
      )

      .input(
        "LIMIT",
        sql.Int,
        safeLimit
      );


    const result =
      await request.execute(
        "A_SP_FOR_SALES_ANALYSIS"
      );


    const rows =
      result.recordset || [];


    console.log(
      `${what} -> ${rows.length} rows`
    );


    // ============================================================
    // RESPONSE
    // ============================================================

    return res.json({

      success: true,

      what: what,

      offset: safeOffset,

      limit: safeLimit,

      data: rows

    });

  }

  catch (err) {

    console.error(
      "================================="
    );

    console.error(
      "PAGED SALES ANALYSIS ERROR"
    );

    console.error(err);

    console.error(
      "================================="
    );


    return res.status(500).json({

      success: false,

      message:
        err.message ||
        "Failed to load paged sales analysis"

    });

  }

});

// ============================================================
// DIRECTOR CUSTOMER LIST
// ============================================================

router.post("/director-customer-list", async (req, res) => {
  try {

    const {
      databaseName,
      userId,
      period,
      fromDate,
      toDate,
    } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool
      .request()

      .input(
        "WHAT",
        sql.NVarChar(50),
        "DIRECTOR_CUSTOMER_LIST"
      )

      .input(
        "USERID",
        sql.NVarChar(100),
        userId || ""
      )

      .input(
        "PERIOD",
        sql.NVarChar(20),
        period || "MONTH"
      )

      .input(
        "FROMDATE",
        sql.Date,
        fromDate || null
      )

      .input(
        "TODATE",
        sql.Date,
        toDate || null
      )

      .execute("A_SP_FOR_SALES_ANALYSIS");

    res.json(result.recordset);

  } catch (err) {

    console.error(
      "DIRECTOR CUSTOMER LIST ERROR:",
      err
    );

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ============================================================
// DIRECTOR CUSTOMER PRODUCTS
// ============================================================

router.post("/director-customer-products", async (req, res) => {
  try {

    const {
      databaseName,
      userId,
      period,
      customerId,
      fromDate,
      toDate,
    } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "customerId is required",
      });
    }

    const pool = await getPool(databaseName);

    const result = await pool
      .request()

      .input(
        "WHAT",
        sql.NVarChar(50),
        "DIRECTOR_CUSTOMER_PRODUCTS"
      )

      .input(
        "USERID",
        sql.NVarChar(100),
        userId || ""
      )

      .input(
        "PERIOD",
        sql.NVarChar(20),
        period || "MONTH"
      )

      .input(
        "FROMDATE",
        sql.Date,
        fromDate || null
      )

      .input(
        "TODATE",
        sql.Date,
        toDate || null
      )

      .input(
        "CUSTOMERUNQID",
        sql.UniqueIdentifier,
        customerId
      )

      .execute("A_SP_FOR_SALES_ANALYSIS");

    res.json(result.recordset);

  } catch (err) {

    console.error(
      "DIRECTOR CUSTOMER PRODUCTS ERROR:",
      err
    );

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ============================================================
// DIRECTOR PRODUCT LIST
// ============================================================

router.post("/director-product-list", async (req, res) => {
  try {

    const {
      databaseName,
      userId,
      period,
      fromDate,
      toDate,
    } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool
      .request()

      .input(
        "WHAT",
        sql.NVarChar(50),
        "DIRECTOR_PRODUCT_LIST"
      )

      .input(
        "USERID",
        sql.NVarChar(100),
        userId || ""
      )

      .input(
        "PERIOD",
        sql.NVarChar(20),
        period || "MONTH"
      )

      .input(
        "FROMDATE",
        sql.Date,
        fromDate || null
      )

      .input(
        "TODATE",
        sql.Date,
        toDate || null
      )

      .execute("A_SP_FOR_SALES_ANALYSIS");

    res.json(result.recordset);

  } catch (err) {

    console.error(
      "DIRECTOR PRODUCT LIST ERROR:",
      err
    );

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.post("/director-product-branch-detail", async (req, res) => {
  try {
    const {
      databaseName,
      userId,
      period,
      productId,
      fromDate,
      toDate,
    } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "productId is required",
      });
    }

    const pool = await getPool(databaseName);

    const result = await pool
      .request()

      .input(
        "WHAT",
        sql.NVarChar(50),
        "DIRECTOR_PRODUCT_BRANCH_DETAIL"
      )

      .input(
        "USERID",
        sql.NVarChar(100),
        userId || ""
      )

      .input(
        "PERIOD",
        sql.NVarChar(20),
        period || "MONTH"
      )

      .input(
        "FROMDATE",
        sql.Date,
        fromDate || null
      )

      .input(
        "TODATE",
        sql.Date,
        toDate || null
      )

      .input(
        "PRODUCTUNQID",
        sql.UniqueIdentifier,
        productId
      )

      .execute("A_SP_FOR_SALES_ANALYSIS");

    res.json(result.recordset);

  } catch (err) {
    console.error(
      "DIRECTOR PRODUCT BRANCH DETAIL ERROR:",
      err
    );

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.post('/purchase-analysis', async (req, res) => {

    try {

        const {
            databaseName,
            productId,
            period,
            dashboardDate
        } = req.body;


        if (!databaseName) {
            return res.status(400).json({
                error: 'databaseName is required'
            });
        }


        if (!productId) {
            return res.status(400).json({
                error: 'productId is required'
            });
        }


        const pool =
            await getPool(databaseName);


        const result =
            await pool.request()

                .input(
                    'WHAT',
                    sql.NVarChar(50),
                    'PRODUCT_PURCHASE_ANALYSIS'
                )

                .input(
                    'PERIOD',
                    sql.NVarChar(20),
                    period || 'MONTH'
                )

                .input(
                    'PRODUCTID',
                    sql.UniqueIdentifier,
                    productId
                )

                .input(
                    'DashboardDate',
                    sql.Date,
                    dashboardDate || new Date()
                )

                .execute(
                    'A_SP_FOR_PURCHASE_ANALYSIS'
                );


        res.json(
            result.recordsets
        );

    } catch (error) {

        console.error(
            'Purchase analysis error:',
            error
        );

        res.status(500).json({
            error:
                'Failed to load purchase analysis',
            details:
                error.message
        });
    }
});

router.post("/today-sales-profit", async (req, res) => {
  try {
    const { databaseName } = req.body;

    if (!databaseName) {
      return res.status(400).json({
        error: "databaseName is required",
      });
    }

    const pool = await getPool(databaseName);

    const result = await pool
      .request()
      .input("WHAT", sql.VarChar, "TODAY_SALES_PROFIT")
      .execute("A_SP_FOR_DASHBOARD_ADMIN");

    return res.json(result.recordsets);
  } catch (error) {
    console.error("TODAY SALES PROFIT ERROR:", error);

    return res.status(500).json({
      error: error.message,
    });
  }
});

router.post("/director-outstanding", async (req, res) => {
  try {

    const { databaseName } = req.body;

    if (!databaseName) {
      return res.status(400).json({
        error: "databaseName is required",
      });
    }

    const pool = await getPool(databaseName);

    const result = await pool
      .request()
      .input(
        "WHAT",
        sql.VarChar,
        "DIRECTOR_OUTSTANDING"
      )
      .execute("A_SP_FOR_DASHBOARD_ADMIN");

    return res.json(result.recordsets);

  } catch (error) {

    console.error(
      "DIRECTOR OUTSTANDING ERROR:",
      error
    );

    return res.status(500).json({
      error: error.message,
    });
  }
});

const sendNotification = require("./services/firebaseNotification");

app.post("/api/director-outstanding-poke", async (req, res) => {
  try {

    const {
      databaseName,
      customerUnq,
      customerName,
      salespersonUserId,
      totalDueAmount,
      dueDays,
    } = req.body;

    if (!databaseName) {
      return res.status(400).json({
        success: false,
        message: "databaseName is required",
      });
    }

    if (!customerUnq) {
      return res.status(400).json({
        success: false,
        message: "customerUnq is required",
      });
    }

    if (!salespersonUserId) {
      return res.status(400).json({
        success: false,
        message: "salespersonUserId is required",
      });
    }

    const pool = await getPool(databaseName);

    // =========================================================
    // FORMAT AMOUNT
    // =========================================================

    const amount = Number(totalDueAmount || 0);

    let amountText;

    if (amount >= 10000000) {

      amountText =
        `₹ ${(amount / 10000000).toFixed(2)} Cr`;

    } else if (amount >= 100000) {

      amountText =
        `₹ ${(amount / 100000).toFixed(2)} L`;

    } else if (amount >= 1000) {

      amountText =
        `₹ ${(amount / 1000).toFixed(2)} K`;

    } else {

      amountText =
        `₹ ${amount.toFixed(0)}`;
    }

    // =========================================================
    // NOTIFICATION MESSAGE
    // =========================================================

    const title = "Collection Required";

    const message =
      `Please collect ${amountText} from ` +
      `${customerName}. Outstanding is ` +
      `${dueDays} days old.`;

    console.log(
      "Poke Target User:",
      salespersonUserId
    );

    console.log(
      "Customer:",
      customerName
    );

    console.log(
      "Outstanding:",
      amountText
    );

    // =========================================================
    // SAVE NOTIFICATION IN DATABASE
    // =========================================================

    await pool
      .request()

      .input(
        "USERID",
        sql.VarChar,
        salespersonUserId
      )

      .input(
        "TITLE",
        sql.VarChar,
        title
      )

      .input(
        "MESSAGE",
        sql.NVarChar,
        message
      )

      .input(
        "REFERENCEID",
        sql.VarChar,
        customerUnq
      )

      .input(
        "DATABASENAME",
        sql.VarChar,
        databaseName
      )

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

    // =========================================================
    // GET SALESPERSON DEVICE TOKEN
    // =========================================================

    const companyPool = await getPool();

    const tokenResult = await companyPool
      .request()

      .input(
        "userId",
        sql.VarChar,
        salespersonUserId
      )

      .query(`
        SELECT DEVICETOKEN
        FROM APP_DEVICE_TOKEN
        WHERE USERID = @userId
      `);

    // =========================================================
    // SEND PUSH NOTIFICATION
    // =========================================================

    if (tokenResult.recordset.length > 0) {

      const token =
        tokenResult.recordset[0].DEVICETOKEN;

      if (token) {

        await sendNotification(
          token,
          title,
          message
        );

        console.log(
          "Poke notification sent successfully"
        );

      } else {

        console.log(
          "Salesperson device token is empty"
        );
      }

    } else {

      console.log(
        "Salesperson device token not found:",
        salespersonUserId
      );
    }

    // =========================================================
    // RESPONSE
    // =========================================================

    return res.json({
      success: true,
      message: "Collection alert sent successfully",
    });

  } catch (err) {

    console.error(
      "DIRECTOR OUTSTANDING POKE ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;