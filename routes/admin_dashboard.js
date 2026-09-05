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

        const { databaseName } = req.body;

        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input("WHAT", sql.NVarChar(200), "MANUFACTURERWISE_PURCHASE")
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
      toDate
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

    const executeSalesAnalysis = async (what) => {

      console.log(
        `Executing A_SP_FOR_SALES_ANALYSIS -> ${what}`
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
        "TOP_PRODUCTS"
      );


    // ============================================================
    // 5. TOP CUSTOMERS
    // ============================================================

    const topCustomers =
      await executeSalesAnalysis(
        "TOP_CUSTOMERS"
      );


    // ============================================================
    // 6. SALESPERSON SALES
    // ============================================================

    const salespersonSales =
      await executeSalesAnalysis(
        "SALESPERSON_SALES"
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

module.exports = router;