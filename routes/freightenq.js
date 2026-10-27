const express = require("express");
const router = express.Router();

const sql = require("mssql");
const { getPool } = require("../config/db");

router.post('/freight-enquiry-masters', async (req, res) => {
    try {
        const { databaseName, userId } = req.body;

        if (!databaseName) {
            return res.status(400).json({
                success: false,
                message: 'databaseName is required'
            });
        }

        const pool = await getPool(databaseName);

        // Get cities, customers, products, transporters, etc.
        const mastersResult = await pool.request()
            .input('WHAT', sql.NVarChar, 'GET_MASTERS')
            .input('TRANSPORTERUNQID', sql.NVarChar, null)
            .execute('A_SP_FOR_FREIGHT_ENQUIRY');

        // Get PO card records from the separate SQL condition.
        const poCardsResult = await pool.request()
            .input('WHAT', sql.NVarChar, 'GET_PO_CARDS')
            .input('TRANSPORTERUNQID', sql.NVarChar, null)
            .execute('A_SP_FOR_FREIGHT_ENQUIRY');

        const masterSets = mastersResult.recordsets || [];

        res.json({
            success: true,

            cities: masterSets[0] || [],
            customers: masterSets[1] || [],
            products: masterSets[2] || [],
            transporters: masterSets[3] || [],

            // Use the dedicated PO-card query.
            purchaseOrders: poCardsResult.recordset || [],

            vehicleTypes: masterSets[5] || []
        });

    } catch (error) {
        console.error(
            'FREIGHT ENQUIRY MASTERS ERROR:',
            error
        );

        res.status(500).json({
            success: false,
            message: error.message
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


router.post("/save-allocation", async (req, res) => {
  try {
    const {
      databaseName,
      poUnqid,
      allocationQty,
      allocationDateTime,
      createdBy,
      freightUnqid,
    } = req.body;

    if (!databaseName || !poUnqid || !allocationDateTime) {
      return res.status(400).json({
        success: false,
        message: "Database, PO and allocation date are required.",
      });
    }

    const qty = Number(allocationQty);

    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: "Allocation quantity must be greater than zero.",
      });
    }

    // Expect an ISO date/time string, e.g. 2026-10-28T00:00:00.000
    // Do not parse it using new Date(), which can introduce timezone shifts.
    const match = String(allocationDateTime).match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/
    );

    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Invalid allocation date/time format.",
      });
    }

    const [, year, month, day, hour, minute, second] = match;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );

    if (
      date.getFullYear() !== Number(year) ||
      date.getMonth() + 1 !== Number(month) ||
      date.getDate() !== Number(day)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid allocation date.",
      });
    }

    const sqlDateTime =
      `${year}-${month}-${day}T${hour}:${minute}:${second}`;

    const pool = await getPool(databaseName);

    const request = pool.request();

    request.input("POUNQID", sql.UniqueIdentifier, poUnqid);

    // Send ISO text; SQL Server converts it to DATETIME2 without
    // applying a timezone conversion.
    request.input(
      "ALLOCATIONDATETIME",
      sql.NVarChar(30),
      sqlDateTime
    );

    request.input(
      "ALLOCATIONQTY",
      sql.Numeric(18, 3),
      qty
    );

    request.input(
      "CREATEDBY",
      sql.NVarChar(100),
      createdBy || null
    );

    request.input(
      "FREIGHTUNQID",
      sql.UniqueIdentifier,
      freightUnqid || null
    );

    const result = await request.execute(
      "A_SP_SAVE_FREIGHT_ALLOCATION"
    );

    const saved = result.recordset?.[0];

    return res.status(200).json({
      success: true,
      message: saved?.MESSAGE || "Allocation saved successfully.",
      data: saved || null,
    });
  } catch (error) {
    console.error("SAVE ALLOCATION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to save allocation.",
    });
  }
});



router.post("/save-allocation-request", async (req, res) => {
  try {
    const {
      databaseName,
      poUnqid,
      requestedQty,
      requestedDateTime,
      createdBy,
    } = req.body;

    if (!databaseName || !poUnqid || !requestedDateTime) {
      return res.status(400).json({
        success: false,
        message: "Database, PO and requested date are required.",
      });
    }

    const qty = Number(requestedQty);

    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: "Requested quantity must be greater than zero.",
      });
    }

    // Expect yyyy-MM-dd, e.g. 2026-10-28.
    // Do not use new Date() for SQL date conversion.
    const match = String(requestedDateTime).match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Invalid requested date format. Use yyyy-MM-dd.",
      });
    }

    const [, year, month, day] = match;

    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );

    if (
      date.getFullYear() !== Number(year) ||
      date.getMonth() + 1 !== Number(month) ||
      date.getDate() !== Number(day)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid requested date.",
      });
    }

    const sqlDate = `${year}-${month}-${day}`;

    const pool = await getPool(databaseName);
    const request = pool.request();

    request.input(
      "POUNQID",
      sql.UniqueIdentifier,
      poUnqid
    );

    // Pass date text directly to SQL Server.
    request.input(
      "REQUESTEDDATE",
      sql.NVarChar(10),
      sqlDate
    );

    request.input(
      "REQUESTEDQTY",
      sql.Numeric(18, 3),
      qty
    );

    request.input(
      "REQUESTEDBY",
      sql.NVarChar(100),
      createdBy || null
    );

    const result = await request.execute(
      "A_SP_SAVE_FREIGHT_ALLOCATION_REQUEST"
    );

    const saved = result.recordset?.[0];

    return res.status(200).json({
      success: true,
      message:
        saved?.MESSAGE ||
        "Allocation request submitted successfully.",
      data: saved || null,
    });
  } catch (error) {
    console.error("SAVE ALLOCATION REQUEST ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to save allocation request.",
    });
  }
});


router.post("/get-allocation-requests", async (req, res) => {
  try {
    const { databaseName } = req.body;

    if (!databaseName) {
      return res.status(400).json({
        success: false,
        message: "Database name is required.",
      });
    }

    const pool = await getPool(databaseName);

    const result = await pool.request().execute(
      "A_SP_GET_FREIGHT_ALLOCATION_REQUESTS"
    );

    return res.status(200).json({
      success: true,
      data: result.recordset || [],
    });
  } catch (error) {
    console.error("GET ALLOCATION REQUESTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Failed to load allocation requests.",
    });
  }
});


router.post("/cancel-allocation-request", async (req, res) => {
  try {
    const {
      databaseName,
      requestUnqid,
      actionBy,
      cancellationReason,
    } = req.body;

    if (!databaseName || !requestUnqid) {
      return res.status(400).json({
        success: false,
        message: "Database and request ID are required.",
      });
    }

    const pool = await getPool(databaseName);
    const request = pool.request();

    request.input(
      "REQUESTUNQID",
      sql.UniqueIdentifier,
      requestUnqid
    );

    request.input(
      "ACTIONBY",
      sql.NVarChar(100),
      actionBy || null
    );

    request.input(
      "CANCELLATIONREASON",
      sql.NVarChar(500),
      cancellationReason || null
    );

    const result = await request.execute(
      "A_SP_CANCEL_FREIGHT_ALLOCATION_REQUEST"
    );

    const saved = result.recordset?.[0];

    return res.status(200).json({
      success: saved?.SUCCESS === true || saved?.SUCCESS === 1,
      message:
        saved?.MESSAGE ||
        "Allocation request cancelled successfully.",
    });
  } catch (error) {
    console.error("CANCEL ALLOCATION REQUEST ERROR:", error);

    const message =
      error.message || "Failed to cancel allocation request.";

    const isValidationError =
      /not found or is no longer pending/i.test(message);

    return res.status(isValidationError ? 409 : 500).json({
      success: false,
      message,
    });
  }
});






module.exports = router;