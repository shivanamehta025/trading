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
      requestUnqid,
      cityUnqid,
    } = req.body;

    if (
      !databaseName ||
      !poUnqid ||
      !allocationDateTime ||
      !createdBy ||
      !cityUnqid
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Database, PO, allocation date, user and city are required.",
      });
    }

    const qty = Number(allocationQty);

    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: "Allocation quantity must be greater than zero.",
      });
    }

    // Keep the date as YYYY-MM-DD; do not convert it with new Date().
    if (!/^\d{4}-\d{2}-\d{2}$/.test(allocationDateTime)) {
      return res.status(400).json({
        success: false,
        message: "Allocation date must be in YYYY-MM-DD format.",
      });
    }

    const pool = await getPool(databaseName);
    const request = pool.request();

    request.input("POUNQID", sql.UniqueIdentifier, poUnqid);
    request.input("ALLOCATIONQTY", sql.Decimal(18, 3), qty);
    request.input("ALLOCATIONDATETIME", sql.Date, allocationDateTime);
    request.input("CREATEDBY", sql.NVarChar(100), createdBy);
    request.input(
      "REQUESTUNQID",
      sql.UniqueIdentifier,
      requestUnqid || null
    );
    request.input("CITYUNQID", sql.UniqueIdentifier, cityUnqid);

    const result = await request.execute(
      "A_SP_SAVE_FREIGHT_ALLOCATION"
    );

    const saved = result.recordset?.[0];

    return res.status(200).json({
      success: saved?.SUCCESS === false || saved?.SUCCESS === 0
        ? false
        : true,
      message:
        saved?.MESSAGE || "Allocation saved successfully.",
    });
  } catch (error) {
    console.error("SAVE FREIGHT ALLOCATION ERROR:", error);

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

    // =====================================
    // VALIDATE REQUEST
    // =====================================

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

    // Validate yyyy-MM-dd without changing the SQL date.
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

    // =====================================
    // SAVE ALLOCATION REQUEST
    // =====================================

    const saveRequest = pool.request();

    saveRequest.input(
      "POUNQID",
      sql.UniqueIdentifier,
      poUnqid
    );

    saveRequest.input(
      "REQUESTEDDATE",
      sql.NVarChar(10),
      sqlDate
    );

    saveRequest.input(
      "REQUESTEDQTY",
      sql.Numeric(18, 3),
      qty
    );

    saveRequest.input(
      "REQUESTEDBY",
      sql.NVarChar(100),
      createdBy || null
    );

    const result = await saveRequest.execute(
      "A_SP_SAVE_FREIGHT_ALLOCATION_REQUEST"
    );

    const saved = result.recordset?.[0];

    // =====================================
    // GET PO NUMBER
    // =====================================

    let poNo = poUnqid;

    try {
      const poResult = await pool
        .request()
        .input("POUNQID", sql.UniqueIdentifier, poUnqid)
        .query(`
          SELECT SM1028_13 AS PONO
          FROM SM1028
          WHERE UNQID = @POUNQID
        `);

      if (poResult.recordset?.length) {
        poNo = poResult.recordset[0].PONO || poUnqid;
      }
    } catch (error) {
      console.error(
        "GET PO NUMBER FOR NOTIFICATION ERROR:",
        error
      );
    }

    // =====================================
    // GET USERS FROM SM504
    // SM504_8 MAY CONTAIN MULTIPLE USER IDS
    // =====================================

    const recipientResult = await pool.request().query(`
      SELECT SM504_8 AS USERIDS
      FROM SM504
      WHERE LTRIM(RTRIM(SM504_4)) = 'Allocation Request'
        AND NULLIF(LTRIM(RTRIM(SM504_8)), '') IS NOT NULL
    `);

    const targetUserIds = [
      ...new Set(
        (recipientResult.recordset || [])
          .flatMap((row) =>
            String(row.USERIDS || "")
              // Supports comma, semicolon, whitespace,
              // and line-break-separated IDs.
              .split(/[,;\\s]+/)
              .map((id) => id.trim())
              .filter(Boolean)
          )
          .map((id) => id.toUpperCase())
      ),
    ];

    console.log(
      "Allocation Request notification recipients:",
      targetUserIds
    );

    const title = "New Allocation Request";

    const message =
      `New allocation request for PO No. ${poNo}. ` +
      `Requested quantity: ${qty}. ` +
      `Requested date: ${sqlDate}.`;

    // =====================================
    // SAVE NOTIFICATION FOR EACH USER
    // =====================================

    for (const targetUserId of targetUserIds) {
      try {
        await pool
          .request()
          .input("USERID", sql.VarChar, targetUserId)
          .input("TITLE", sql.VarChar, title)
          .input("MESSAGE", sql.NVarChar, message)
          .input(
            "REFERENCEID",
            sql.VarChar,
            saved?.UNQID ||
              saved?.REQUESTUNQID ||
              poUnqid
          )
          .input("DATABASENAME", sql.VarChar, databaseName)
          .query(`
            INSERT INTO APP_NOTIFICATION
            (
              USERID,
              TITLE,
              MESSAGE,
              REFERENCEID,
              DATABASENAME
            )
            VALUES
            (
              @USERID,
              @TITLE,
              @MESSAGE,
              @REFERENCEID,
              @DATABASENAME
            )
          `);

        console.log(
          "Allocation notification saved for:",
          targetUserId
        );
      } catch (notificationError) {
        console.error(
          `Failed to save notification for ${targetUserId}:`,
          notificationError
        );
      }
    }

    // =====================================
    // SEND FCM PUSH TO EACH USER
    // =====================================

    try {
      if (targetUserIds.length > 0) {
        const companyPool = await getPool();

        for (const targetUserId of targetUserIds) {
          try {
            const tokenResult = await companyPool
              .request()
              .input("USERID", sql.VarChar, targetUserId)
              .query(`
                SELECT DISTINCT DEVICETOKEN
                FROM APP_DEVICE_TOKEN
                WHERE UPPER(LTRIM(RTRIM(USERID))) = @USERID
                  AND DEVICETOKEN IS NOT NULL
                  AND LTRIM(RTRIM(DEVICETOKEN)) <> ''
              `);

            const tokens = [
              ...new Set(
                (tokenResult.recordset || [])
                  .map((row) => row.DEVICETOKEN)
                  .filter(Boolean)
              ),
            ];

            for (const token of tokens) {
              try {
                await sendNotification(
                  token,
                  title,
                  message
                );
              } catch (pushError) {
                console.error(
                  `FCM failed for ${targetUserId}:`,
                  pushError
                );
              }
            }

            console.log(
              `FCM processing completed for ${targetUserId}. ` +
              `Tokens found: ${tokens.length}`
            );
          } catch (userPushError) {
            console.error(
              `Unable to process push for ${targetUserId}:`,
              userPushError
            );
          }
        }
      }
    } catch (pushError) {
      console.error(
        "ALLOCATION PUSH NOTIFICATION ERROR:",
        pushError
      );
    }

    // =====================================
    // RESPONSE
    // =====================================

    return res.status(200).json({
      success: true,
      message:
        saved?.MESSAGE ||
        "Allocation request submitted successfully.",
      data: saved || null,
      notificationsSentTo: targetUserIds,
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


router.post("/cancel-allocation", async (req, res) => {
  try {
    const {
      databaseName,
      allocationUnqid,
      cancelledBy,
      cancellationReason,
    } = req.body;

    if (!databaseName || !allocationUnqid) {
      return res.status(400).json({
        success: false,
        message: "Database and allocation ID are required.",
      });
    }

    const reason = String(cancellationReason || "").trim();

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Cancellation reason is required.",
      });
    }

    if (reason.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Cancellation reason cannot exceed 500 characters.",
      });
    }

    const pool = await getPool(databaseName);
    const request = pool.request();

    request.input(
      "ALLOCATIONUNQID",
      sql.UniqueIdentifier,
      allocationUnqid
    );

    request.input(
      "CANCELLEDBY",
      sql.NVarChar(100),
      cancelledBy || null
    );

    request.input(
      "CANCELLATIONREASON",
      sql.NVarChar(500),
      reason
    );

    const result = await request.execute(
      "A_SP_CANCEL_FREIGHT_ALLOCATION"
    );

    const saved = result.recordset?.[0];

    if (
      !saved ||
      (saved.SUCCESS !== true && saved.SUCCESS !== 1)
    ) {
      return res.status(400).json({
        success: false,
        message: saved?.MESSAGE ||
          "Allocation could not be cancelled.",
      });
    }

    return res.status(200).json({
      success: true,
      message: saved.MESSAGE ||
        "Allocation cancelled successfully.",
      data: saved,
    });
  } catch (error) {
    console.error("CANCEL ALLOCATION ERROR:", error);

    const message =
      error.originalError?.info?.message ||
      error.message ||
      "Failed to cancel allocation.";

    const isValidationError =
      /not found|only active allocations|reason is required|status changed|linked request could not be cancelled/i.test(
        message
      );

    return res.status(isValidationError ? 409 : 500).json({
      success: false,
      message,
    });
  }
});

router.post("/allocation-cities", async (req, res) => {
  try {
    const { databaseName, supplierUnqid } = req.body;

    if (!databaseName || !supplierUnqid) {
      return res.status(400).json({
        success: false,
        message: "Database and supplier ID are required.",
      });
    }

    const pool = await getPool(databaseName);
    const request = pool.request();

    request.input(
      "SUPPLIERUNQID",
      sql.UniqueIdentifier,
      supplierUnqid
    );

    const result = await request.query(`
      SET NOCOUNT ON;

      DECLARE @SUPPLIERNAME NVARCHAR(200);

      SELECT @SUPPLIERNAME = SM19_5
      FROM dbo.SM19
      WHERE UNQID = @SUPPLIERUNQID;

      IF @SUPPLIERNAME IS NULL
      BEGIN
        THROW 50101, 'Supplier not found.', 1;
      END;

      -- GACL supplier: allow Baroda and Dahej.
      IF UPPER(@SUPPLIERNAME) LIKE '%GACL%'
      BEGIN
        SELECT
          UNQID,
          SM1_5 AS CITYNAME
        FROM dbo.SM01
        WHERE UNQID IN (
          'ACB728C2-C41D-4531-B3D0-AB292A2214BF',
          'A34EA6D7-2983-4562-9E18-CD936EFB48A1'
        )
        ORDER BY SM1_5;
      END
      ELSE
      BEGIN
        -- Other suppliers: use their mapped city.
        SELECT
          C.UNQID,
          C.SM1_5 AS CITYNAME
        FROM dbo.SM01 C
        INNER JOIN dbo.SM19 S
          ON S.SM19_15 = C.UNQID
        WHERE S.UNQID = @SUPPLIERUNQID
        ORDER BY C.SM1_5;
      END;
    `);

    const cities = result.recordset || [];

    return res.json({
      success: true,
      cities,
      autoSelectCity: cities.length === 1,
    });
  } catch (error) {
    console.error("ALLOCATION CITIES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to load supplier cities.",
    });
  }
});









module.exports = router;