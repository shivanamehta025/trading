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
        console.log("Customer Name:", customerName);
        console.log("Mobile:", mobileNo);
        console.log("Call Start:", callStartTime);
        console.log("Call Connected:", callConnectedTime);
        console.log("Call End:", callEndTime);
        console.log("Duration:", durationSeconds);
        console.log("Status:", callStatus);
        console.log("Outcome:", callOutcome);
        console.log("Remarks:", remarks);
        console.log("Next Followup:", nextFollowUpDate);
        console.log("Purpose:", callPurpose);
        console.log("Payment Days:", paymentAfterDays);
        console.log("Expected Payment:", expectedPaymentDate);
        console.log("Products:", products);
        console.log("====================================");

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
                customerUnq || null
            )

            .input(
                "SALESPERSONUNQ",
                sql.VarChar(100),
                salespersonUnq || null
            )

            .input(
                "CUSTOMERNAME",
                sql.VarChar(250),
                customerName || null
            )

            .input(
                "MOBILENO",
                sql.VarChar(30),
                mobileNo || null
            )

            .input(
                "CALLSTARTTIME",
                sql.DateTime,
                callStartTime
                    ? new Date(callStartTime)
                    : null
            )

            .input(
                "CALLCONNECTEDTIME",
                sql.DateTime,
                callConnectedTime
                    ? new Date(callConnectedTime)
                    : null
            )

            .input(
                "CALLENDTIME",
                sql.DateTime,
                callEndTime
                    ? new Date(callEndTime)
                    : null
            )

            .input(
                "DURATIONSECONDS",
                sql.Int,
                Number(durationSeconds) || 0
            )

            .input(
                "CALLSTATUS",
                sql.VarChar(30),
                callStatus || null
            )

            .input(
                "CALLOUTCOME",
                sql.VarChar(50),
                callOutcome || null
            )

            .input(
                "REMARKS",
                sql.VarChar(1000),
                remarks || null
            )

            .input(
                "NEXTFOLLOWUPDATE",
                sql.Date,
                nextFollowUpDate
                    ? new Date(nextFollowUpDate)
                    : null
            )

            .input(
                "CALLPURPOSE",
                sql.VarChar(30),
                callPurpose || null
            )

            .input(
                "PAYMENTAFTERDAYS",
                sql.Int,
                paymentAfterDays != null
                    ? Number(paymentAfterDays)
                    : null
            )

            .input(
                "EXPECTEDPAYMENTDATE",
                sql.Date,
                expectedPaymentDate
                    ? new Date(expectedPaymentDate)
                    : null
            )

            .input(
                "PRODUCTS",
                sql.NVarChar(sql.MAX),
                JSON.stringify(products || [])
            )

            .execute("A_SP_SALES_CALL");


        console.log(
            "SP RECORDSET:",
            result.recordset
        );


        const spResult =
            result.recordset &&
            result.recordset.length > 0
                ? result.recordset[0]
                : null;


        if (!spResult) {

            console.error(
                "SP DID NOT RETURN RESULT"
            );

            return res.status(500).json({
                success: false,
                message: "Stored procedure did not return a result"
            });
        }


        const success =
            Number(spResult.Success) === 1;


        const message =
            spResult.Message ||
            (
                success
                    ? "Call saved successfully"
                    : "Call was not saved"
            );


        console.log(
            "SP SUCCESS:",
            spResult.Success
        );

        console.log(
            "SP MESSAGE:",
            message
        );


        return res.json({
            success: success,
            message: message,
            data: spResult,
        });


    } catch (error) {

        console.error(
            "===================================="
        );

        console.error(
            "SAVE SALES CALL ERROR:"
        );

        console.error(error);

        console.error(
            "===================================="
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