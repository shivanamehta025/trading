const express = require("express");
const router = express.Router();

const sql = require("mssql");
const { getPool } = require("../config/db");


router.post('/transfer-sales', async (req, res) => {
  try {
    const { databaseName } = req.body;

    if (!databaseName) {
      return res.status(400).json({
        success: false,
        message: 'databaseName is required',
      });
    }

    const pool = await getPool(databaseName);

    const result = await pool.request()
      .input('what', sql.NVarChar(20), 'binddropdown')
      .execute('A_SP_FOR_TRANSFER_SALES_APP');

    res.json({
      success: true,
      salesmen: result.recordset,
    });
  } catch (error) {
    console.error('Transfer Sales Dropdown Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/transfer-sales-customers', async (req, res) => {
  try {
    const {
      databaseName,
      FDATE,
      TDATE,
      salesman,
    } = req.body;

    if (!databaseName || !FDATE || !TDATE || !salesman) {
      return res.status(400).json({
        success: false,
        message: 'databaseName, FDATE, TDATE and salesman are required',
      });
    }

    const pool = await getPool(databaseName);

    const result = await pool.request()
      .input('what', sql.NVarChar(20), 'bindcustomer')
      .input('FDATE', sql.NVarChar(50), FDATE)
      .input('TDATE', sql.NVarChar(50), TDATE)
      .input('salesman', sql.NVarChar(50), salesman)
      .execute('A_SP_FOR_TRANSFER_SALES_APP');

    return res.json({
      success: true,
      customers: result.recordset,
    });
  } catch (error) {
    console.error('Transfer Sales Customer Error:', error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/transfer-sales-update', async (req, res) => {
  try {
    const {
      databaseName,
      FDATE,
      TDATE,
      FSALESMAN,
      TSALESMAN,
      CUSTUNQ,
    } = req.body;

    if (
      !databaseName ||
      !FDATE ||
      !TDATE ||
      !FSALESMAN ||
      !TSALESMAN ||
      !CUSTUNQ
    ) {
      return res.status(400).json({
        success: false,
        message:
          'databaseName, FDATE, TDATE, FSALESMAN, TSALESMAN and CUSTUNQ are required',
      });
    }

    if (FSALESMAN === TSALESMAN) {
      return res.status(400).json({
        success: false,
        message: 'Source and destination salesmen must be different',
      });
    }

    // Accept either a quoted comma-separated string or an array.
    let customerIds;

    if (Array.isArray(CUSTUNQ)) {
      customerIds = CUSTUNQ;
    } else {
      const cleaned = String(CUSTUNQ).trim()
        .replace(/^['"]|['"]$/g, '');

      customerIds = cleaned.split(',');
    }

    customerIds = customerIds
      .map(id => String(id).trim())
      .filter(Boolean);

    if (customerIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one customer',
      });
    }

    const custUnqString = customerIds.join(',');

    const pool = await getPool(databaseName);

    const result = await pool.request()
      .input('what', sql.NVarChar(20), 'update')
      .input('FDATE', sql.NVarChar(50), FDATE)
      .input('TDATE', sql.NVarChar(50), TDATE)
      .input('salesman', sql.NVarChar(50), FSALESMAN)
      .input('TSALESMAN', sql.NVarChar(50), TSALESMAN)
      .input('CUSTUNQ', sql.NVarChar(sql.MAX), custUnqString)
      .execute('A_SP_FOR_TRANSFER_SALES_APP');

    return res.status(200).json({
      success: true,
      message: 'Sales transfer completed successfully',
      data: result.recordset || [],
    });
  } catch (error) {
    console.error('Transfer Sales Update Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to transfer sales',
      error: error.message,
    });
  }
});


module.exports = router;