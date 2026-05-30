const sql = require("mssql");
require("dotenv").config();

const pools = {};

async function getPool(databaseName) {

  const dbName =
    databaseName ||
    process.env.DB_NAME ||
    "GJAUTOSHOP";

  if (pools[dbName]) {
    return pools[dbName];
  }

  const config = {
    user: process.env.DB_USER || "Administrator",
    password: process.env.DB_PASSWORD || "ggf@fsha_5!58ar4",
    server: "103.123.53.84",
    port: parseInt(process.env.DB_PORT) || 5000,

    database: dbName,

    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
    },

    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },

    connectionTimeout: 30000,
    requestTimeout: 30000,
  };

  const pool = await new sql.ConnectionPool(config).connect();

  pools[dbName] = pool;

  console.log(`✅ Connected to database: ${dbName}`);

  return pool;
}

module.exports = {
  getPool,
  sql,
};