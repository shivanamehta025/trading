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
            .input('WHAT', sql.NVarChar, 'GET_MASTERS')
            .input('TRANSPORTERUNQID', sql.NVarChar, null)
            .execute('A_SP_FOR_FREIGHT_ENQUIRY');

        res.json({
            success: true,

            cities: result.recordsets[0],
            customers: result.recordsets[1],
            products: result.recordsets[2],
            transporters: result.recordsets[3],
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

        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input(
                'what',
                sql.NVarChar(50),
                'GET_PO_DETAILS'
            )
            .input(
                'pounqid',
                sql.NVarChar(50),
                poUnqid
            )
            .execute(
                'A_SP_FOR_FREIGHT_ENQUIRY_APP'
            );

        res.json({
            success: true,
            data: result.recordset?.[0] ?? {}
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