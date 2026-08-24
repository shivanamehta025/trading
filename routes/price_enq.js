const express = require("express");
const router = express.Router();

const sql = require("mssql");
const { getPool } = require("../config/db");
router.post("/get-products_price", async (req, res) => {
    try {

        const {
            databaseName,
            userId
        } = req.body;

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

        const result = await pool.request()

            .input(
                "WHAT",
                sql.VarChar(50),
                "GET_PRODUCTS"
            )

            .input(
                "USERID",
                sql.NVarChar(20),
                userId
            )

            .execute("A_SP_PRICE_ENQUIRY");

        res.json({
            success: true,
            data: result.recordset || []
        });

    } catch (error) {

        console.error(
            "GET PRODUCTS ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;