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

module.exports = router;