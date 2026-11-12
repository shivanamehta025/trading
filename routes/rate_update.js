const express = require("express");
const router = express.Router();

const sql = require("mssql");
const { getPool } = require("../config/db");

router.post('/rate-update-bindfreight', async (req, res) => {
    try {
        const { databaseName, product } = req.body;

        if (!databaseName || !product) {
            return res.status(400).json({
                success: false,
                message: 'Database name and product are required'
            });
        }

        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input('what', sql.NVarChar(50), 'bindfreight')
            .input('PRODUCT', sql.NVarChar(50), product)
            .execute('A_SP_FOR_RATE_UPDATE_APP');

        return res.json({
            success: true,
            data: result.recordset || []
        });

    } catch (error) {
        console.error('Rate Update API Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/rate-update-insert', async (req, res) => {
    try {
        const {
            databaseName,
            userId,
            date,
            manufactureId,
            productId,
            branches
        } = req.body;

        if (!databaseName || !userId || !date || !productId ||
            !Array.isArray(branches) || branches.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Required rate details are missing'
            });
        }

        const pool = await getPool(databaseName);
        const savedBranches = [];

        for (const branch of branches) {
            const result = await pool.request()
                .input('what', sql.NVarChar(50), 'insertrate')
                .input('PRODUCT', sql.NVarChar(50), productId)
                .input('unqid', sql.NVarChar(50), '')
                .input('cunqid', sql.NVarChar(50), '')
                .input('SM1017_3', sql.NVarChar(50), userId)
                .input('SM1017_6', sql.NVarChar(50), date)
                .input('SM1017_7', sql.NVarChar(50), branch.branchId)
                .input('SM1017_8', sql.NVarChar(50), manufactureId)

                .input('sm1017_c3', sql.NVarChar(50), userId)
                .input('sm1017_c100', sql.NVarChar(50), '')
                .input('sm1017_c5', sql.NVarChar(50), '')
                .input('sm1017_c6', sql.NVarChar(50), productId)
                .input('sm1017_c7', sql.NVarChar(50), '')
                .input('sm1017_c8', sql.NVarChar(50), '0.00')
                .input('sm1017_c9', sql.NVarChar(50), '0.00')
                .input('sm1017_c10', sql.NVarChar(50), branch.cashRate)
                .input('sm1017_c11', sql.NVarChar(50), branch.creditRate)
                .input('sm1017_c12', sql.NVarChar(50), '')

                .execute('A_SP_FOR_RATE_UPDATE_APP');

            savedBranches.push({
                branchId: branch.branchId
            });
        }

        return res.json({
            success: true,
            message: `Rates saved successfully for ${savedBranches.length} branches.`,
            savedBranches
        });

    } catch (error) {
        console.error('Rate Insert API Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/rate-update-dropdown', async (req, res) => {
    try {
        const { databaseName } = req.body;

        if (!databaseName) {
            return res.status(400).json({
                success: false,
                message: 'Database name is required'
            });
        }

        const pool = await getPool(databaseName);

        const result = await pool.request()
            .input('what', sql.NVarChar(50), 'binddropdown')
            .execute('A_SP_FOR_RATE_UPDATE_APP');

        return res.json({
            success: true,
            products: result.recordset || []
        });

    } catch (error) {
        console.error('Product Dropdown Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;