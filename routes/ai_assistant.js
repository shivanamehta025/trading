const express = require("express");
const router = express.Router();

const sql = require("mssql");
const { getPool } = require("../config/db");
router.post("/ai-assistant", async (req, res) => {
    try {

        const { databaseName, message } = req.body;

        let what = "";

        const text = message.toLowerCase();

        if (
            text.includes("today") &&
            text.includes("sale")
        ) {
            what = "TODAY_SALES";
        }

        else {
            return res.json({
                success: false,
                message: "Sorry, I don't understand this question yet."
            });
        }

        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input("WHAT", sql.NVarChar(100), what)
            .execute("A_SP_FOR_AI_ASSISTANT");

        res.json({
            success: true,
            intent: what,
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