const express = require("express");
const router = express.Router();

const sql = require("mssql");
const { getPool } = require("../config/db");
router.post("/ai-assistant", async (req, res) => {
    try {

        const { databaseName, what } = req.body;

        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input("WHAT", sql.NVarChar(100), what)
            .execute("A_SP_FOR_AI_ASSISTANT");

        res.json({
            success: true,
            data: result.recordset[0]
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }
});

module.exports = router;