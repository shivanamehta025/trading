const express = require("express");
const router = express.Router();

const sql = require("mssql");
const { getPool } = require("../config/db");

const sendNotification = require("../services/firebaseNotification");

router.post('/enquiry-bind-dropdown', async (req, res) => {

    try {

        const {
            databaseName
        } = req.body;

        const pool = await getPool(databaseName);

        const result = await pool.request()

            .input('what', sql.NVarChar(50), 'binddropdown')

            .execute('A_SP_FOR_ENQUIRYMASTER_APP');

        res.json({

            success: true,

            customer: result.recordsets[0],

            product: result.recordsets[1],

            manufacturer: result.recordsets[2],

            remark: result.recordsets[3],

            enquiryType: result.recordsets[4],

            city: result.recordsets[5],

            enquiryno: result.recordsets[6]

        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

router.post('/enquiry-add-customer', async (req, res) => {
    try {
        const { databaseName, userid, name, city, mobile } = req.body;
        const pool = await getPool(databaseName);
 
        const result = await pool.request()
            .input('what', sql.NVarChar(50), 'customername')
            .input('userid', sql.NVarChar(50), userid)
            .input('cname', sql.NVarChar(50), name)
            .input('city', sql.NVarChar(50), city)
            .input('mobno', sql.NVarChar(50), mobile)
            .execute('A_SP_FOR_ENQUIRYMASTER_APP');
        const unqid = result.recordset?.[0]?.unqid;
 
        res.json({ success: true, unqid });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/enquiry-bind-mf', async (req, res) => {

  try {

      const {
          databaseName, prounq
      } = req.body;

      const pool = await getPool(databaseName);

      const result = await pool.request()
          .input('what', sql.NVarChar(50), 'bindmf')
          .input('prounq', sql.NVarChar(50), prounq)
          .execute('A_SP_FOR_ENQUIRYMASTER_APP');

      res.json({
          success: true,
          manufacturerVisit: result.recordsets[0],
          manufacturerRate: result.recordsets[1]
      });

  }

  catch (err) {

      console.error(err);

      res.status(500).json({

          success: false,

          message: err.message

      });

  }

});

router.post('/enquiry-save', async (req, res) => {
    try {
        const {
            databaseName,
            e_3, e_4, e_6, intime, e_8, outtime,
            e_10, e_11, e_12, e_13, e_14, e_15, unq, products
        } = req.body;
 
        const pool = await getPool(databaseName);
 
        const parentResult = await pool.request()
            .input('what', sql.NVarChar(50), 'save')
            .input('e_3', sql.NVarChar(50), e_3)
            .input('e_4', sql.NVarChar(50), e_4)
            .input('e_6', sql.NVarChar(50), e_6)
            .input('intime', sql.NVarChar(50), intime)
            .input('e_8', sql.NVarChar(50), e_8)
            .input('outtime', sql.NVarChar(50), outtime)
            .input('e_10', sql.NVarChar(50), e_10)
            .input('e_11', sql.NVarChar(20), e_11)
            .input('e_12', sql.NVarChar(50), e_12)
            .input('e_13', sql.NVarChar(50), e_13)
            .input('e_14', sql.NVarChar(sql.MAX), e_14)
            .input('e_15', sql.NVarChar(sql.MAX), e_15)
            .input('unq', sql.NVarChar(50), unq)
            .execute('A_SP_FOR_ENQUIRYMASTER_APP');
 
        const parentUnq = parentResult.recordset?.[0]?.unq;
 
        for (const p of (products || [])) {
            await pool.request()
                .input('what', sql.NVarChar(50), 'savechild')
                .input('e_3', sql.NVarChar(50), e_3)
                .input('e_4', sql.NVarChar(50), e_4)
                .input('e_c6', sql.NVarChar(50), parentUnq)
                .input('e_c7', sql.VarChar(10), p.e_c7)
                .input('e_c8', sql.NVarChar(50), p.e_c8)
                .input('e_c9', sql.VarChar(10), p.e_c9)
                .input('e_c10', sql.NVarChar(50), p.e_c10)
                .input('e_c11', sql.NVarChar(50), p.e_c11)
                .input('e_c12', sql.NVarChar(sql.MAX), p.e_c12)
                .input('e_c18', sql.NVarChar(sql.MAX), p.e_c18)

                .execute('A_SP_FOR_ENQUIRYMASTER_APP');
        }
 
        res.json({ success: true, unq: parentUnq });
 
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post("/create-enquiry-notification", async (req, res) => {
  try {
    const { databaseName, referenceId, targetUser, title, message, documenttype, fromUser } = req.body;

    const pool = await getPool(databaseName);
    const companyPool = await getPool();

    const userIds = (targetUser || '').split(',').map(u => u.trim()).filter(Boolean);

    for (const uid of userIds) {
      await pool.request()
        .input("USERID", sql.VarChar, uid)
        .input("TITLE", sql.VarChar, title)
        .input("MESSAGE", sql.NVarChar, message)
        .input("REFERENCEID", sql.VarChar, referenceId)
        .input("DATABASENAME", sql.VarChar, databaseName)
        .input("DOCUMENTTYPE", sql.VarChar, documenttype || "")
        .input("FROMUSER", sql.VarChar, fromUser || "")
        .query(`
          INSERT INTO APP_NOTIFICATION
          (USERID, TITLE, MESSAGE, REFERENCEID, DATABASENAME, ISREAD, CREATEDON, DOCUMENTTYPE, FROMUSER)
          VALUES
          (@USERID, @TITLE, @MESSAGE, @REFERENCEID, @DATABASENAME, 0, GETDATE(), @DOCUMENTTYPE, @FROMUSER)
        `);

      const tokenResult = await companyPool.request()
        .input("userId", sql.VarChar, uid)
        .query(`SELECT DEVICETOKEN FROM APP_DEVICE_TOKEN WHERE USERID = @userId`);

      if (tokenResult.recordset.length > 0) {
        await sendNotification(tokenResult.recordset[0].DEVICETOKEN, title, message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/enquiry-bind-data', async (req, res) => {
    try {
        const { databaseName, unq } = req.body;
        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input('what', sql.NVarChar(50), 'BINDDATA')
            .input('unq', sql.NVarChar(50), unq)
            .execute('A_SP_FOR_ENQUIRYMASTER_APP');

        res.json({
            success: true,
            enquiry: result.recordsets[0][0] || null,
            products: result.recordsets[1] || []
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/bind-rate', async (req, res) => {
    try {
        const { databaseName, enquiryUnq, prounq, qty, formDate } = req.body;
        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input('what', sql.NVarChar(50), 'bindrate')
            .input('e_c6', sql.NVarChar(50), enquiryUnq)
            .input('e_c8', sql.NVarChar(50), prounq)
            .input('e_c11', sql.Decimal(18, 2), qty)
            .input('Fdate', sql.NVarChar(50), formDate)
            .execute('A_SP_FOR_ENQUIRYMASTER_APP');

        res.json({
            success: true,
            cash: result.recordsets[0]?.[0]?.cash ?? 0,
            credit: result.recordsets[1]?.[0]?.credit ?? 0,
            singlefreightamt: result.recordsets[2]?.[0]?.singlefreightamt ?? 0,
            margin: result.recordsets[3]?.[0]?.margin ?? 0,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/enquiry-total-rate', async (req, res) => {
    try {
        const { databaseName, cash, credit, single, margin } = req.body;
        const pool = await getPool(databaseName);

        const marginResult = await pool.request()
            .input('what', sql.NVarChar(50), 'MarginAmt')
            .input('CASH', sql.Decimal(18, 2), cash)
            .input('CREDIT', sql.Decimal(18, 2), credit)
            .input('SINGLE', sql.Decimal(18, 2), single)
            .input('MARGIN', sql.Decimal(18, 2), margin)
            .execute('A_SP_FOR_ENQUIRYMASTER_APP');

        const margin1 = marginResult.recordset[0]?.MARGIN1 ?? 0;
        const margin2 = marginResult.recordset[0]?.MARGIN2 ?? 0;

        const totalResult = await pool.request()
            .input('what', sql.NVarChar(50), 'Totalrate')
            .input('CASH', sql.Decimal(18, 2), cash)
            .input('CREDIT', sql.Decimal(18, 2), credit)
            .input('SINGLE', sql.Decimal(18, 2), single)
            .input('margin1', sql.Decimal(18, 2), margin1)
            .input('margin2', sql.Decimal(18, 2), margin2)
            .execute('A_SP_FOR_ENQUIRYMASTER_APP');

        res.json({
            success: true,
            margin1,
            margin2,
            total1: totalResult.recordset[0]?.Total1 ?? 0,
            total2: totalResult.recordset[0]?.Total2 ?? 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/enquiry-save-child-total', async (req, res) => {
    try {
        const { databaseName, enquiryUnq, prounq, margin, totcas, totcrs } = req.body;
        const pool = await getPool(databaseName);

        await pool.request()
            .input('what', sql.NVarChar(50), 'childtotup')
            .input('e_c6', sql.NVarChar(50), enquiryUnq)
            .input('e_c8', sql.NVarChar(50), prounq)
            .input('e_c13', sql.Decimal(18, 2), margin)
            .input('e_c14', sql.Decimal(18, 2), totcas)
            .input('e_c15', sql.Decimal(18, 2), totcrs)
            .execute('A_SP_FOR_ENQUIRYMASTER_APP');

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/enquiry-rem-stock', async (req, res) => {
    try {
        const { databaseName, unq } = req.body;
        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input('what', sql.NVarChar(50), 'remstock')
            .input('unq', sql.NVarChar(50), unq)
            .execute('A_SP_FOR_ENQUIRYMASTER_APP');

        res.json({
            success: true,
            stock: result.recordset || []
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/get-notify-targets', async (req, res) => {
    try {
        const { databaseName, keytype } = req.body;
        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input('what', sql.NVarChar(50), 'gettargetusers')
            .input('keytype', sql.NVarChar(100), keytype)
            .execute('A_SP_FOR_ENQUIRYMASTER_APP');

        res.json({
            success: true,
            targetUser: result.recordset[0]?.USERID ?? ''
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/enquiry-admin-rate-save', async (req, res) => {
    try {
        const { databaseName, unq, prounq, cash, credit } = req.body;
        const pool = await getPool(databaseName);

        await pool.request()
            .input('what', sql.NVarChar(50), 'adminratesave')
            .input('unq', sql.NVarChar(50), unq)
            .input('prounq', sql.NVarChar(50), prounq)
            .input('cash', sql.Decimal(18, 2), cash)
            .input('credit', sql.Decimal(18, 2), credit)
            .execute('A_SP_FOR_ENQUIRYMASTER_APP');

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/enquiry-in-out-time', async (req, res) => {
    try {
        const { databaseName, unq, e_3, intime, outtime, e_8, e_16, e_17 } = req.body;
        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input('what', sql.NVarChar(50), 'insinouttime')
            .input('unq', sql.NVarChar(50), unq || '')
            .input('e_3', sql.NVarChar(50), e_3)
            .input('intime', sql.NVarChar(50), intime || '')
            .input('outtime', sql.NVarChar(50), outtime || '')
            .input('e_8', sql.NVarChar(50), e_8)
            .input('e_16', sql.NVarChar(100), e_16 || '')
            .input('e_17', sql.NVarChar(100), e_17 || '')

            .execute('A_SP_FOR_ENQUIRYMASTER_APP');

        const recordsets = result.recordsets || [];
        let punqid = '';
        let msg = '';

        for (const rs of recordsets) {
            if (rs[0]?.PUNQID) punqid = rs[0].PUNQID;
            if (rs[0]?.msg !== undefined) msg = rs[0].msg;
        }

        res.json({ success: true, unq: punqid, message: msg });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/enquiry-check-pending-visit', async (req, res) => {
    try {
        const { databaseName, e_3 } = req.body;
        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input('what', sql.NVarChar(50), 'checkpendingvisit')
            .input('e_3', sql.NVarChar(50), e_3)
            .execute('A_SP_FOR_ENQUIRYMASTER_APP');

        res.json({
            success: true,
            unq: result.recordset[0]?.PUNQID ?? ''
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/enquiry-payment-followup', async (req, res) => {
    try {
        const {
            databaseName,
            customerName,
            toDate
        } = req.body;

        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input('what', sql.NVarChar(50), 'payfollowup')
            .input('CUSTNAME', sql.NVarChar(50), customerName)
            .input('TODATE', sql.NVarChar(50), toDate)
            .execute('A_SP_FOR_ENQUIRYMASTER_APP');

        res.json({
            success: true,
            data: result.recordset || []
        });

    } catch (err) {
        console.error(
            'PAYMENT FOLLOW-UP ERROR:',
            err
        );

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

router.post('/enquiry-payment-followup-save', async (req, res) => {
  try {
    const {
      databaseName,
      invnUnq,
      remarks
    } = req.body;

    if (!databaseName) {
      return res.status(400).json({
        success: false,
        message: 'Database name is required'
      });
    }

    if (!invnUnq) {
      return res.status(400).json({
        success: false,
        message: 'Invoice UNQID is required'
      });
    }

    const pool = await getPool(databaseName);

    const result = await pool.request()
      .input('what', sql.NVarChar(50), 'SavePAYFOLLOWUP')
      .input('INVNUNQ', sql.NVarChar(50), invnUnq)
      .input(
        'REMARKS',
        sql.NVarChar(sql.MAX),
        Array.isArray(remarks) ? remarks.join(', ') : (remarks || '')
      )
      .execute('A_SP_FOR_ENQUIRYMASTER_APP');

    res.json({
      success: true,
      message: 'Payment follow-up saved successfully'
    });

  } catch (err) {
    console.error('Payment Follow-up Save Error:', err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

router.post('/enquiry-invoice-deliver', async (req, res) => {
    try {
        const { databaseName } = req.body;
        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input('what', sql.NVarChar(50), 'INVDELIVER')
            .execute('A_SP_FOR_ENQUIRYMASTER_APP');

        res.json({
            success: true,
            data: result.recordset || []
        });
    } catch (err) {
        console.error('INVOICE DELIVER LOAD ERROR:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

router.post('/enquiry-invoice-deliver-save', async (req, res) => {
    try {
        const { databaseName, invnUnq } = req.body;

        if (!databaseName) {
            return res.status(400).json({
                success: false,
                message: 'Database name is required'
            });
        }

        if (!invnUnq) {
            return res.status(400).json({
                success: false,
                message: 'Invoice UNQID is required'
            });
        }

        const pool = await getPool(databaseName);

        await pool.request()
            .input('what', sql.NVarChar(50), 'SAVEINVDELIVER')
            .input('INVNUNQ', sql.NVarChar(100), invnUnq)
            .execute('A_SP_FOR_ENQUIRYMASTER_APP');

        res.json({
            success: true,
            message: 'Invoice marked as delivered successfully'
        });
    } catch (err) {
        console.error('INVOICE DELIVER SAVE ERROR:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

router.post('/enquiry-customer-product-average', async (req, res) => {
    try {
        const { databaseName, customerId } = req.body;

        if (!databaseName) {
            return res.status(400).json({
                success: false,
                message: 'Database name is required'
            });
        }

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: 'Customer id is required'
            });
        }

        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input('what', sql.NVarChar(50), 'CUSTPRODUCTAVG')
            .input('CUSTNAME', sql.NVarChar(50), customerId)
            .execute('A_SP_FOR_ENQUIRYMASTER_APP');

        res.json({
            success: true,
            data: result.recordset || []
        });
    } catch (err) {
        console.error('CUSTOMER PRODUCT AVERAGE ERROR:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});
module.exports = router;