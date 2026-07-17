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


module.exports = router;