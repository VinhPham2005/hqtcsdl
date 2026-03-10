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

// Forbidden SQL keywords to prevent modification
const FORBIDDEN_KEYWORDS = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'TRUNCATE'];

app.post('/api/query', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Invalid query format' });
        }

        const upperQuery = query.toUpperCase();

        // Check for forbidden keywords
        const isForbidden = FORBIDDEN_KEYWORDS.some(keyword => {
            // Check if keyword is used as a whole word
            const regex = new RegExp(`\\b${keyword}\\b`);
            return regex.test(upperQuery);
        });

        if (isForbidden) {
            return res.status(403).json({ error: 'Only SELECT queries are allowed.' });
        }
        
        // Also verify the query starts with SELECT (basic protection)
        if (!upperQuery.trim().startsWith('SELECT')) {
            return res.status(403).json({ error: 'Query must start with SELECT.' });
        }

        // Connect to the database
        await sql.connect(dbConfig);
        
        // Execute the query
        const result = await sql.query(query);
        
        // Return both records and columns metadata for the frontend
        res.json({
            success: true,
            records: result.recordset || [],
            columns: result.recordset && result.recordset.length > 0 ? Object.keys(result.recordset[0]) : []
        });

    } catch (err) {
        console.error('SQL Error:', err);
        res.status(500).json({ error: err.message || 'Error executing query' });
    } finally {
        // Ensure connection is closed (optional check but good practice if not pooling globally, though mssql handles pooling)
        // Usually you can leave the pool open, but for simplicity we can close or let the pool manage it.
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
