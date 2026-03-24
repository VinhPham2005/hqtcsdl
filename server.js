require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Database configuration
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: false, // For local dev, encryption is usually false. Set to true if on Azure
        trustServerCertificate: true // Trust local certificates
    }
};


// Global connection pool
let poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then(pool => {
        console.log('Connected to SQL Server');
        return pool;
    })
    .catch(err => {
        console.error('Database Connection Failed! Bad Config: ', err);
        process.exit(1);
    });

// API endpoint to execute query
app.post('/api/query', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query || typeof query !== 'string' || query.trim() === '') {
            return res.status(400).json({ error: 'Invalid query format' });
        }

        const pool = await poolPromise;
        const result = await pool.request().query(query);
        
        res.json({
            success: true,
            records: result.recordset || [],
            columns: result.recordset && result.recordset.length > 0 ? Object.keys(result.recordset[0]) : [],
            rowsAffected: result.rowsAffected.length > 0 ? result.rowsAffected[0] : 0
        });

    } catch (err) {
        console.error('SQL Error during /api/query:', err.message);
        res.status(500).json({ error: err.message || 'Error executing query' });
    }
});

// API endpoint to get database schema
app.get('/api/schema', async (req, res) => {
    try {
        const schemaQuery = `
            SELECT c.TABLE_NAME, c.COLUMN_NAME, c.DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS c
            JOIN INFORMATION_SCHEMA.TABLES t ON c.TABLE_NAME = t.TABLE_NAME
            WHERE t.TABLE_TYPE = 'BASE TABLE' AND t.TABLE_NAME != 'sysdiagrams'
            ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION;
        `;
        
        const pool = await poolPromise;
        const result = await pool.request().query(schemaQuery);
        
        // Group by table
        const tables = {};
        if (result.recordset) {
            result.recordset.forEach(row => {
                if (!tables[row.TABLE_NAME]) {
                    tables[row.TABLE_NAME] = [];
                }
                tables[row.TABLE_NAME].push({
                    name: row.COLUMN_NAME,
                    type: row.DATA_TYPE
                });
            });
        }
        
        res.json({ success: true, schema: tables });
    } catch (err) {
        console.error('SQL Error during /api/schema:', err.message);
        res.status(500).json({ error: 'Error fetching database schema' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
