const express = require("express");
const router = express.Router();

const sql = require("mssql");
const { getPool } = require("../config/db");

router.post('/freight-enquiry-masters', async (req, res) => {
    try {

        const {
            databaseName,
            userId
        } = req.body;

        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input(
                'WHAT',
                sql.NVarChar,
                'GET_MASTERS'
            )
            .input(
                'TRANSPORTERUNQID',
                sql.NVarChar,
                null
            )
            .execute('A_SP_FOR_FREIGHT_ENQUIRY');

        res.json({
            success: true,

            // 1
            cities: result.recordsets[0] || [],

            // 2
            customers: result.recordsets[1] || [],

            // 3
            products: result.recordsets[2] || [],

            // 4
            transporters: result.recordsets[3] || [],

            // 5 - PO TABLE
            purchaseOrders: result.recordsets[4] || [],

            vehicleTypes: result.recordsets[5] || [],
        });

    } catch (error) {

        console.error(
            'FREIGHT ENQUIRY MASTERS ERROR:',
            error
        );

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});
router.post('/freight-enquiry-vehicles', async (req, res) => {
    try {

        const {
            databaseName,
            userId,
            transporterUnqid
        } = req.body;

        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input(
                'WHAT',
                sql.NVarChar,
                'GET_VEHICLES'
            )
            .input(
                'TRANSPORTERUNQID',
                sql.NVarChar,
                transporterUnqid
            )
            .execute('A_SP_FOR_FREIGHT_ENQUIRY');

        res.json({
            success: true,
            vehicles: result.recordsets[0],
        });

    } catch (error) {

        console.error(
            'FREIGHT VEHICLE ERROR:',
            error
        );

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

router.post('/freight-enquiry-by-po', async (req, res) => {

    try {

        const {
            databaseName,
            poUnqid
        } = req.body;

        console.log(
            '======================================'
        );

        console.log(
            'FREIGHT PO DETAILS API'
        );

        console.log(
            'DATABASE:',
            databaseName
        );

        console.log(
            'POUNQID:',
            poUnqid
        );

        console.log(
            '======================================'
        );


        if (!databaseName) {

            return res.status(400).json({
                success: false,
                message: 'databaseName is required'
            });

        }


        if (!poUnqid) {

            return res.status(400).json({
                success: false,
                message: 'poUnqid is required'
            });

        }


        const pool =
            await getPool(databaseName);


        const result =
            await pool.request()

                .input(
                    'WHAT',
                    sql.NVarChar(50),
                    'GET_PO_DETAILS'
                )

                .input(
                    'TRANSPORTERUNQID',
                    sql.NVarChar(100),
                    null
                )

                .input(
                    'POUNQID',
                    sql.NVarChar(100),
                    poUnqid
                )

                .execute(
                    'A_SP_FOR_FREIGHT_ENQUIRY'
                );


        console.log(
            'PO RECORDSETS:',
            result.recordsets
        );


        res.json({

            success: true,

            data:
                result.recordset &&
                result.recordset.length > 0
                    ? result.recordset[0]
                    : null

        });

    } catch (error) {

        console.error(
            '======================================'
        );

        console.error(
            'FREIGHT PO API ERROR'
        );

        console.error(
            error
        );

        console.error(
            '======================================'
        );


        res.status(500).json({

            success: false,

            message:
                error.message,

            error:
                error.originalError
                    ?.message ||
                null

        });

    }

});


module.exports = router;