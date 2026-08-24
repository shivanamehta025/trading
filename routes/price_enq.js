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

// ============================================================
// PRICE ENQUIRY
// CREATE + ADD PRODUCTS + SUBMIT
// ============================================================

router.post("/price-enquiry", async (req, res) => {

    try {

        const {
            databaseName,
            userId,
            products,
            remarks
        } = req.body;


        // =====================================================
        // VALIDATION
        // =====================================================

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


        if (!Array.isArray(products) ||
            products.length === 0) {

            return res.status(400).json({
                success: false,
                message: "At least one product is required"
            });
        }


        // =====================================================
        // DATABASE
        // =====================================================

        const pool = await getPool(databaseName);


        // =====================================================
        // 1. CREATE MASTER
        // =====================================================

        const createResult = await pool.request()

            .input(
                "WHAT",
                sql.VarChar(50),
                "CREATE"
            )

            .input(
                "USERUNQ",
                sql.UniqueIdentifier,
                userId
            )

            .input(
                "REMARKS",
                sql.NVarChar(1000),
                remarks || null
            )

            .execute("A_SP_PRICE_ENQUIRY");


        const createData =
            createResult.recordset?.[0];


        if (!createData ||
            createData.STATUS !== "SUCCESS") {

            return res.status(400).json({
                success: false,
                message:
                    createData?.MESSAGE ||
                    "Unable to create price enquiry"
            });
        }


        const enquiryUnq =
            createData.ENQUIRYUNQ;


        console.log(
            "PRICE ENQUIRY CREATED:",
            enquiryUnq
        );


        // =====================================================
        // 2. ADD PRODUCTS
        // =====================================================

        for (const product of products) {

            const {
                productId,
                qty,
                priceRequired,
                requestedRate,
                requestedAvailability,
                requestedDaysFrom,
                requestedDaysTo
            } = product;


            // -------------------------------------------------
            // PRODUCT VALIDATION
            // -------------------------------------------------

            if (!productId) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Product ID is required",
                    enquiryUnq
                });
            }


            if (qty === undefined ||
                qty === null ||
                Number(qty) <= 0) {

                return res.status(400).json({
                    success: false,
                    message:
                        `Invalid quantity for product ${productId}`,
                    enquiryUnq
                });
            }


            if (!requestedAvailability ||
                ![
                    "IMMEDIATE",
                    "TODAY",
                    "DAYS"
                ].includes(
                    requestedAvailability
                )) {

                return res.status(400).json({
                    success: false,
                    message:
                        `Invalid availability for product ${productId}`,
                    enquiryUnq
                });
            }


            // -------------------------------------------------
            // RATE VALIDATION
            // -------------------------------------------------

            if (!priceRequired) {

                if (
                    requestedRate === null ||
                    requestedRate === undefined ||
                    Number(requestedRate) <= 0
                ) {

                    return res.status(400).json({
                        success: false,
                        message:
                            `Requested rate is required for product ${productId}`,
                        enquiryUnq
                    });
                }
            }


            // -------------------------------------------------
            // DAYS VALIDATION
            // -------------------------------------------------

            if (requestedAvailability === "DAYS") {

                if (
                    requestedDaysFrom === null ||
                    requestedDaysFrom === undefined ||
                    requestedDaysTo === null ||
                    requestedDaysTo === undefined
                ) {

                    return res.status(400).json({
                        success: false,
                        message:
                            `Days range is required for product ${productId}`,
                        enquiryUnq
                    });
                }


                if (
                    Number(requestedDaysFrom) < 0 ||
                    Number(requestedDaysTo) <
                    Number(requestedDaysFrom)
                ) {

                    return res.status(400).json({
                        success: false,
                        message:
                            `Invalid days range for product ${productId}`,
                        enquiryUnq
                    });
                }

            }


            // -------------------------------------------------
            // ADD PRODUCT
            // -------------------------------------------------

            const addResult =
                await pool.request()

                    .input(
                        "WHAT",
                        sql.VarChar(50),
                        "ADD_PRODUCT"
                    )

                    .input(
                        "ENQUIRYUNQ",
                        sql.UniqueIdentifier,
                        enquiryUnq
                    )

                    .input(
                        "PRODUCTID",
                        sql.NVarChar(100),
                        productId
                    )

                    .input(
                        "QTY",
                        sql.Decimal(18, 3),
                        qty
                    )

                    .input(
                        "PRICEREQUIRED",
                        sql.Bit,
                        priceRequired ? 1 : 0
                    )

                    .input(
                        "REQUESTEDRATE",
                        sql.Decimal(18, 2),
                        priceRequired
                            ? null
                            : requestedRate
                    )

                    .input(
                        "REQUESTEDAVAILABILITY",
                        sql.VarChar(20),
                        requestedAvailability
                    )

                    .input(
                        "REQUESTEDDAYSFROM",
                        sql.Int,
                        requestedAvailability === "DAYS"
                            ? requestedDaysFrom
                            : null
                    )

                    .input(
                        "REQUESTEDDAYSTO",
                        sql.Int,
                        requestedAvailability === "DAYS"
                            ? requestedDaysTo
                            : null
                    )

                    .input(
                        "REMARKS",
                        sql.NVarChar(1000),
                        null
                    )

                    .execute(
                        "A_SP_PRICE_ENQUIRY"
                    );


            const addData =
                addResult.recordset?.[0];


            if (!addData ||
                addData.STATUS !== "SUCCESS") {

                return res.status(400).json({
                    success: false,
                    message:
                        addData?.MESSAGE ||
                        `Unable to add product ${productId}`,
                    enquiryUnq
                });
            }


            console.log(
                "PRICE ENQUIRY PRODUCT ADDED:",
                productId
            );
        }


        // =====================================================
        // 3. SUBMIT FOR APPROVAL
        // =====================================================

        const submitResult =
            await pool.request()

                .input(
                    "WHAT",
                    sql.VarChar(50),
                    "SUBMIT"
                )

                .input(
                    "ENQUIRYUNQ",
                    sql.UniqueIdentifier,
                    enquiryUnq
                )

                .input(
                    "USERUNQ",
                    sql.UniqueIdentifier,
                    userId
                )

                .execute(
                    "A_SP_PRICE_ENQUIRY"
                );


        const submitData =
            submitResult.recordset?.[0];


        if (!submitData ||
            submitData.STATUS !== "SUCCESS") {

            return res.status(400).json({
                success: false,
                message:
                    submitData?.MESSAGE ||
                    "Unable to submit price enquiry",
                enquiryUnq
            });
        }


        // =====================================================
        // SUCCESS
        // =====================================================

        console.log(
            "PRICE ENQUIRY SUBMITTED:",
            enquiryUnq
        );


        return res.status(200).json({
            success: true,
            message:
                "Price enquiry submitted for approval",
            enquiryUnq
        });


    } catch (error) {

        console.error(
            "PRICE ENQUIRY ERROR:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Internal server error"
        });
    }
});

module.exports = router;