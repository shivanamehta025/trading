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

module.exports = router;