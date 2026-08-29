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

router.post('/save-freight-enquiry', async (req, res) => {

    try {

        const {
            databaseName,
            userId,

            poUnqid,
            pono,

            fromCity,
            toCity,

            product,
            customer,

            quantity,

            transporter,
            transporterUnqids,
            vehicle,
            vehicleType,

            driverName,
            driverMobile,

            freight
        } = req.body;


        console.log(
            '========== SAVE FREIGHT ENQUIRY =========='
        );

        console.log('DATABASE:', databaseName);
        console.log('USER:', userId);
        console.log('PO:', poUnqid);
        console.log('FROM:', fromCity);
        console.log('TO:', toCity);
        console.log('PRODUCT:', product);
        console.log('CUSTOMER:', customer);
        console.log('QUANTITY:', quantity);
        console.log('TRANSPORTER:', transporter);
        console.log('VEHICLE:', vehicle);
        console.log('VEHICLE TYPE:', vehicleType);
        console.log('DRIVER:', driverName);
        console.log('DRIVER MOBILE:', driverMobile);
        console.log('FREIGHT:', freight);
        console.log('TRANSPORTER UNQIDS:',transporterUnqids);


        if (!databaseName) {
            return res.status(400).json({
                success: false,
                message: 'databaseName is required'
            });
        }


        const pool =
            await getPool(databaseName);

            console.log('');
console.log('==========================================');
console.log('FREIGHT ENQUIRY SQL REQUEST');
console.log('==========================================');

console.log('DATABASE       =', databaseName);
console.log('USER           =', userId);

console.log('PO             =', poUnqid);
console.log('PONO           =', pono);

console.log('FROM           =', fromCity);
console.log('TO             =', toCity);

console.log('PRODUCT        =', product);
console.log('CUSTOMER       =', customer);
console.log('QUANTITY       =', quantity);

console.log('TRANSPORTER    =', transporter);
console.log(
    'TRANSPORTERS   =',
    transporterUnqids
);
console.log(
    'TRANSPORTER COUNT =',
    transporterUnqids
        ? transporterUnqids.split(',').length
        : 0
);

console.log('VEHICLE        =', vehicle);
console.log('VEHICLE TYPE    =', vehicleType);

console.log('DRIVER NAME    =', driverName);
console.log('DRIVER MOBILE  =', driverMobile);
console.log('FREIGHT        =', freight);

console.log('==========================================');


        const result =
            await pool.request()

                .input(
                    'WHAT',
                    sql.NVarChar(50),
                    'SAVE_ENQUIRY'
                )

                

                .input(
    'TRANSPORTERUNQID',
    sql.NVarChar(sql.MAX),
    transporterUnqids || null
)

                .input(
                    'POUNQID',
                    sql.UniqueIdentifier,
                    poUnqid
                )

                .input(
                    'PONO',
                    sql.NVarChar(50),
                    pono
                )

                .input(
                    'FROMCITY',
                    sql.UniqueIdentifier,
                    fromCity
                )

                .input(
                    'TOCITY',
                    sql.UniqueIdentifier,
                    toCity
                )

                .input(
                    'PRODUCT',
                    sql.UniqueIdentifier,
                    product
                )

                .input(
                    'CUSTOMER',
                    sql.UniqueIdentifier,
                    customer
                )

                .input(
                    'QUANTITY',
                    sql.Decimal(18, 3),
                    quantity
                )

               .input(
    'TRANSPORTER',
    sql.UniqueIdentifier,
    transporter || null
)

                .input(
    'VEHICLE',
    sql.UniqueIdentifier,
    vehicle || null
)

                .input(
                    'VEHICLETYPE',
                    sql.UniqueIdentifier,
                    vehicleType
                )

                .input(
                    'DRIVERNAME',
                    sql.NVarChar(100),
                    driverName
                )

                .input(
                    'DRIVERMOBILE',
                    sql.NVarChar(20),
                    driverMobile
                )

                .input(
    'FREIGHT',
    sql.Decimal(18, 2),
    freight === '' || freight == null
        ? null
        : freight
)

                .input(
                    'CREATEDBY',
                    sql.NVarChar(50),
                    userId
                )

                .execute(
                    'A_SP_FOR_FREIGHT_ENQUIRY'
                );


        const record =
            result.recordset?.[0];


        res.json({
            success: true,

            message:
                'Freight enquiry saved successfully',

            data: record || null
        });


} catch (error) {

    console.error('');
    console.error('==========================================');
    console.error('SAVE FREIGHT ENQUIRY FAILED');
    console.error('==========================================');

    console.error('MESSAGE:', error.message);
    console.error('NUMBER:', error.number);
    console.error('STATE:', error.state);
    console.error('CLASS:', error.class);
    console.error('CODE:', error.code);
    console.error('PROCEDURE:', error.procName);
    console.error('LINE:', error.lineNumber);

    console.error('FULL ERROR:');
    console.error(error);

    console.error('==========================================');

    res.status(500).json({
        success: false,
        message: error.message,
        number: error.number,
        state: error.state,
        code: error.code,
        procedure: error.procName,
        line: error.lineNumber
    });
}
});

router.post('/freight-enquiry-next-no', async (req, res) => {

    try {

        const { databaseName } = req.body;

        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input(
                'WHAT',
                sql.NVarChar(50),
                'GET_NEXT_ENQUIRY_NO'
            )
            .execute(
                'A_SP_FOR_FREIGHT_ENQUIRY'
            );

        res.json({
            success: true,
            data: result.recordset?.[0] || null
        });

    } catch (error) {

        console.error(
            'NEXT FREIGHT ENQUIRY ERROR:',
            error
        );

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/get-freight', async (req, res) => {
    try {
        const {
            databaseName,
            vehicleNo,
            enqDate,
            fromCity,
            toCity,
            transporter,
            product
        } = req.body;

        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input('WHAT', sql.NVarChar(50), 'GET_FREIGHT')
            .input('VEHICLENO', sql.UniqueIdentifier, vehicleNo)
            .input('ENQDATE', sql.Date, enqDate)
            .input('FROMCITY', sql.UniqueIdentifier, fromCity)
            .input('TOCITY', sql.UniqueIdentifier, toCity)
            .input('TRANSPORTER', sql.UniqueIdentifier, transporter)
            .input('PRODUCT', sql.UniqueIdentifier, product)
            .execute('A_SP_FOR_FREIGHT_ENQUIRY');

        res.json({
            success: true,
            freight: result.recordset.length > 0
                ? result.recordset[0].FREIGHT
                : null
        });

    } catch (error) {
        console.error('GET FREIGHT ERROR:', error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/get-freight-approval-list', async (req, res) => {

    try {

        const {
            databaseName,
            userId
        } = req.body;


        if (!databaseName) {
            return res.status(400).json({
                success: false,
                message: 'databaseName is required'
            });
        }


        const pool = await getPool(databaseName);


        const result = await pool.request()

            .input(
                'WHAT',
                sql.NVarChar(50),
                'GET_FREIGHT_APPROVALS'
            )

            .input(
                'POUNQID',
                sql.NVarChar(100),
                null
            )

            .execute(
                'A_SP_FOR_FREIGHT_ENQUIRY'
            );


        res.json({
            success: true,
            data: result.recordset || []
        });

    } catch (error) {

        console.error(
            'GET FREIGHT APPROVAL LIST ERROR:',
            error
        );

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/get-freight-approval-detail', async (req, res) => {

    try {

        const {
            databaseName,
            userId,
            enquiryUnqid
        } = req.body;


        if (!databaseName) {
            return res.status(400).json({
                success: false,
                message: 'databaseName is required'
            });
        }


        if (!enquiryUnqid) {
            return res.status(400).json({
                success: false,
                message: 'enquiryUnqid is required'
            });
        }


        const pool = await getPool(databaseName);


        const result = await pool.request()

            .input(
                'WHAT',
                sql.NVarChar(50),
                'GET_FREIGHT_APPROVAL_DETAIL'
            )

            .input(
                'POUNQID',
                sql.UniqueIdentifier,
                enquiryUnqid
            )

            .execute(
                'A_SP_FOR_FREIGHT_ENQUIRY'
            );


        res.json({

            success: true,

            parent:
                result.recordsets?.[0]?.[0] || null,

            quotations:
                result.recordsets?.[1] || []

        });

    } catch (error) {

        console.error(
            'GET FREIGHT APPROVAL DETAIL ERROR:',
            error
        );

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/approve-freight', async (req, res) => {

    try {

        const {
            databaseName,
            userId,
            childUnqid
        } = req.body;


        console.log(
            '========== APPROVE FREIGHT =========='
        );

        console.log(
            'DATABASE:',
            databaseName
        );

        console.log(
            'USER:',
            userId
        );

        console.log(
            'CHILD:',
            childUnqid
        );


        if (!databaseName) {
            return res.status(400).json({
                success: false,
                message: 'databaseName is required'
            });
        }


        if (!childUnqid) {
            return res.status(400).json({
                success: false,
                message: 'childUnqid is required'
            });
        }


        const pool = await getPool(databaseName);


        const result = await pool.request()

            .input(
                'WHAT',
                sql.NVarChar(50),
                'APPROVE_FREIGHT'
            )

            // Here POUNQID carries the CHILD UNQID
            .input(
                'POUNQID',
                sql.UniqueIdentifier,
                childUnqid
            )

            .execute(
                'A_SP_FOR_FREIGHT_ENQUIRY'
            );


        const record =
            result.recordset?.[0] || null;


        res.json({

            success: true,

            message:
                record?.MESSAGE ||
                'Freight approved successfully',

            data: record

        });

    } catch (error) {

        console.error(
            'APPROVE FREIGHT ERROR:',
            error
        );

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

});

router.post('/get-freight-enquiry-list', async (req, res) => {

    try {

        const {
            databaseName,
            userId
        } = req.body;

        console.log(
            '========== GET FREIGHT ENQUIRY LIST =========='
        );

        console.log('DATABASE:', databaseName);
        console.log('USER:', userId);

        if (!databaseName) {
            return res.status(400).json({
                success: false,
                message: 'databaseName is required'
            });
        }

        const pool = await getPool(databaseName);

        const result = await pool.request()

            .input(
                'WHAT',
                sql.NVarChar(50),
                'GET_FREIGHT_ENQUIRY_LIST'
            )

            .input(
                'CREATEDBY',
                sql.NVarChar(50),
                userId
            )

            .execute(
                'A_SP_FOR_FREIGHT_ENQUIRY'
            );

        res.json({
            success: true,
            data: result.recordset || []
        });

    } catch (error) {

        console.error(
            'GET FREIGHT ENQUIRY LIST ERROR:',
            error
        );

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


module.exports = router;