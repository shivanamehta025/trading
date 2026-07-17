const express = require("express");
const router = express.Router();

const sql = require("mssql");
const { getPool } = require("../config/db");
router.post("/top-growing-products", async (req, res) => {

  const { databaseName, userId } = req.body;

  try {

    const pool = await getPool(databaseName);

    const result = await pool.request()

      .input("WHAT", sql.VarChar, "TOP_GROWING_PRODUCTS")

      .input("USERID", sql.VarChar, userId)

      .execute("A_SP_FOR_DASHBOARD_APP");

    res.json(result.recordset);

  } catch (err) {

    console.error(err);

    res.status(500).json(err.message);

  }

});

router.post('/customer-health-details', async (req, res) => {

  try {

    const { databaseName, userId, type } = req.body;

    const pool = await getPool(databaseName);

    const result = await pool.request()

      .input('WHAT', sql.NVarChar(100), 'CUSTOMER_HEALTH_DETAILS')
      .input('USERID', sql.NVarChar(100), userId)
      .input('TYPE', sql.NVarChar(50), type)

      .execute('A_SP_FOR_DASHBOARD_APP');

    res.json(result.recordset);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });

  }

});


module.exports = router;