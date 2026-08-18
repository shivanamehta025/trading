const express = require("express");
const router = express.Router();

const sql = require("mssql");
const { getPool } = require("../config/db");

router.post("/save-sales-call", async (req, res) => {
    try {

        const {
            databaseName,
            customerUnq,
            salespersonUnq,
            customerName,
            mobileNo,
            callStartTime,
            callConnectedTime,
            callEndTime,
            durationSeconds,
            callStatus,
            callOutcome,
            remarks,
            nextFollowUpDate,
            callPurpose,
            paymentAfterDays,
            expectedPaymentDate,
            products
        } = req.body;

        console.log("========== SAVE SALES CALL ==========");
        console.log("Database:", databaseName);
        console.log("Customer:", customerUnq);
        console.log("Salesperson:", salespersonUnq);
        console.log("Purpose:", callPurpose);
        console.log("Products:", products);
        console.log("=====================================");

        const pool = await getPool(databaseName);

        const result = await pool.request()

            .input(
                "WHAT",
                sql.VarChar(50),
                "SAVE"
            )

            .input(
                "CUSTOMERUNQ",
                sql.UniqueIdentifier,
                customerUnq
            )

            .input(
                "SALESPERSONUNQ",
                sql.VarChar(100),
                salespersonUnq
            )

            .input(
                "CUSTOMERNAME",
                sql.VarChar(250),
                customerName
            )

            .input(
                "MOBILENO",
                sql.VarChar(30),
                mobileNo
            )

            .input(
                "CALLSTARTTIME",
                sql.DateTime,
                callStartTime
            )

            .input(
                "CALLCONNECTEDTIME",
                sql.DateTime,
                callConnectedTime
            )

            .input(
                "CALLENDTIME",
                sql.DateTime,
                callEndTime
            )

            .input(
                "DURATIONSECONDS",
                sql.Int,
                durationSeconds
            )

            .input(
                "CALLSTATUS",
                sql.VarChar(30),
                callStatus
            )

            .input(
                "CALLOUTCOME",
                sql.VarChar(50),
                callOutcome
            )

            .input(
                "REMARKS",
                sql.VarChar(1000),
                remarks
            )

            .input(
                "NEXTFOLLOWUPDATE",
                sql.Date,
                nextFollowUpDate
            )

            .input(
                "CALLPURPOSE",
                sql.VarChar(30),
                callPurpose
            )

            .input(
                "PAYMENTAFTERDAYS",
                sql.Int,
                paymentAfterDays
            )

            .input(
                "EXPECTEDPAYMENTDATE",
                sql.Date,
                expectedPaymentDate
            )

            .input(
                "PRODUCTS",
                sql.NVarChar(sql.MAX),
                products || ""
            )

            .execute("A_SP_SALES_CALL");

        console.log("SP RECORDSET:", result.recordset);

        const spResult =
            result.recordset &&
            result.recordset.length > 0
                ? result.recordset[0]
                : null;

        console.log(
            "SP SUCCESS:",
            spResult?.Success
        );

        console.log(
            "SP MESSAGE:",
            spResult?.Message
        );

        return res.json({
            success:
                spResult?.Success === 1,

            message:
                spResult?.Message,

            data:
                result.recordset
        });

    } catch (error) {

        console.error(
            "SAVE SALES CALL ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.post("/get-products", async (req, res) => {
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

            .execute("A_SP_SALES_CALL");

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