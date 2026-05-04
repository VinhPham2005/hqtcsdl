require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// ─── MongoDB Connection ──────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'health_fitness_db';

let db;
const client = new MongoClient(MONGO_URI);

async function connectDB() {
    try {
        await client.connect();
        db = client.db(MONGO_DB);
        console.log(`✅ Connected to MongoDB — database: ${MONGO_DB}`);
    } catch (err) {
        console.error('❌ MongoDB Connection Failed:', err.message);
        process.exit(1);
    }
}

// ─── Security: Sanitize Filter ───────────────────────────────────────────────
// Block dangerous operators to prevent NoSQL injection
const BLOCKED_OPERATORS = [
    '$where', '$expr', '$function', '$accumulator',
    '$merge', '$out', '$lookup', '$graphLookup',
    '$unionWith', '$currentOp', '$listSessions'
];

function sanitizeFilter(obj) {
    if (obj === null || obj === undefined) return {};
    if (typeof obj !== 'object' || Array.isArray(obj)) {
        if (Array.isArray(obj)) {
            return obj.map(item => {
                if (typeof item === 'object' && item !== null) {
                    return sanitizeFilter(item);
                }
                return item;
            });
        }
        return {};
    }

    const clean = {};
    for (const key of Object.keys(obj)) {
        // Block dangerous operators
        if (BLOCKED_OPERATORS.includes(key.toLowerCase())) {
            console.warn(`⚠️  Blocked dangerous operator: ${key}`);
            continue;
        }

        const val = obj[key];
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            clean[key] = sanitizeFilter(val);
        } else if (Array.isArray(val)) {
            clean[key] = val.map(item => {
                if (typeof item === 'object' && item !== null) {
                    return sanitizeFilter(item);
                }
                return item;
            });
        } else {
            clean[key] = val;
        }
    }
    return clean;
}

// ─── API: Get Database Schema ────────────────────────────────────────────────
app.get('/api/schema', async (req, res) => {
    try {
        const collections = await db.listCollections().toArray();
        const schema = {};

        for (const col of collections) {
            const collName = col.name;
            // Sample one document to extract field names & types
            const sample = await db.collection(collName).findOne({});
            if (sample) {
                schema[collName] = extractFields(sample);
            } else {
                schema[collName] = [{ name: '_id', type: 'ObjectId' }];
            }
        }

        res.json({ success: true, schema });
    } catch (err) {
        console.error('Schema Error:', err.message);
        res.status(500).json({ error: 'Error fetching database schema' });
    }
});

// Extract field names & types from a sample document (supports nested)
function extractFields(doc, prefix = '') {
    const fields = [];
    for (const [key, val] of Object.entries(doc)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const type = getMongoType(val);

        if (type === 'Object' && val !== null && !(val instanceof ObjectId) && !isDate(val)) {
            // Show the parent object field itself
            fields.push({ name: fullKey, type: 'Object' });
            // Then recurse into nested fields
            fields.push(...extractFields(val, fullKey));
        } else if (type === 'Array' && Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
            fields.push({ name: fullKey, type: 'Array<Object>' });
            fields.push(...extractFields(val[0], `${fullKey}[]`));
        } else {
            fields.push({ name: fullKey, type });
        }
    }
    return fields;
}

function isDate(val) {
    return val instanceof Date || Object.prototype.toString.call(val) === '[object Date]';
}

function getMongoType(val) {
    if (val === null || val === undefined) return 'null';
    if (val instanceof ObjectId) return 'ObjectId';
    if (isDate(val)) return 'Date';
    if (Array.isArray(val)) return 'Array';
    if (typeof val === 'object') return 'Object';
    if (typeof val === 'number') return Number.isInteger(val) ? 'Int' : 'Double';
    if (typeof val === 'boolean') return 'Boolean';
    if (typeof val === 'string') return 'String';
    return typeof val;
}

// ─── API: Execute Query (find only) ─────────────────────────────────────────
app.post('/api/query', async (req, res) => {
    try {
        const { collection, filter, projection, sort, limit } = req.body;

        // Validate collection name
        if (!collection || typeof collection !== 'string' || collection.trim() === '') {
            return res.status(400).json({ error: 'Collection name is required' });
        }

        // Validate collection exists
        const collList = await db.listCollections({ name: collection.trim() }).toArray();
        if (collList.length === 0) {
            return res.status(400).json({ error: `Collection "${collection}" does not exist` });
        }

        // Parse & sanitize filter
        let parsedFilter = {};
        if (filter && typeof filter === 'object') {
            parsedFilter = sanitizeFilter(filter);
        }

        // Parse projection
        let parsedProjection = undefined;
        if (projection && typeof projection === 'object' && Object.keys(projection).length > 0) {
            parsedProjection = projection;
        }

        // Parse sort
        let parsedSort = undefined;
        if (sort && typeof sort === 'object' && Object.keys(sort).length > 0) {
            parsedSort = sort;
        }

        // Parse limit (max 1000)
        let parsedLimit = 100;
        if (limit && typeof limit === 'number' && limit > 0) {
            parsedLimit = Math.min(limit, 1000);
        }

        // Execute FIND only
        let cursor = db.collection(collection.trim()).find(parsedFilter);

        if (parsedProjection) {
            cursor = cursor.project(parsedProjection);
        }
        if (parsedSort) {
            cursor = cursor.sort(parsedSort);
        }
        cursor = cursor.limit(parsedLimit);

        const records = await cursor.toArray();

        // Flatten ObjectId for display
        const flatRecords = records.map(doc => flattenDoc(doc));

        // Extract columns from all records (union of keys)
        const columnSet = new Set();
        flatRecords.forEach(doc => {
            Object.keys(doc).forEach(k => columnSet.add(k));
        });

        res.json({
            success: true,
            records: flatRecords,
            columns: Array.from(columnSet),
            totalCount: flatRecords.length
        });

    } catch (err) {
        console.error('Query Error:', err.message);
        res.status(500).json({ error: err.message || 'Error executing query' });
    }
});

// Flatten nested objects for table display
function flattenDoc(doc, prefix = '', result = {}) {
    for (const [key, val] of Object.entries(doc)) {
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (val instanceof ObjectId) {
            result[newKey] = val.toString();
        } else if (isDate(val)) {
            result[newKey] = val.toISOString();
        } else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
            flattenDoc(val, newKey, result);
        } else if (Array.isArray(val)) {
            // Keep short arrays as JSON string, flatten single-element object arrays
            if (val.length <= 3 && val.every(v => typeof v !== 'object')) {
                result[newKey] = val.join(', ');
            } else {
                result[newKey] = JSON.stringify(val);
            }
        } else {
            result[newKey] = val;
        }
    }
    return result;
}

// ─── API: Execute Aggregate Pipeline ─────────────────────────────────────────
const ALLOWED_STAGES = [
    '$group', '$sort', '$limit', '$match', '$project', '$unwind',
    '$count', '$addFields', '$lookup', '$skip', '$bucket', '$bucketAuto',
    '$facet', '$sample', '$replaceRoot', '$sortByCount', '$set',
    '$redact', '$replaceWith'
];
const BLOCKED_STAGES = ['$merge', '$out', '$currentOp', '$listSessions'];

app.post('/api/aggregate', async (req, res) => {
    try {
        const { collection, pipeline } = req.body;

        // Validate collection name
        if (!collection || typeof collection !== 'string' || collection.trim() === '') {
            return res.status(400).json({ error: 'Collection name is required' });
        }

        // Validate collection exists
        const collList = await db.listCollections({ name: collection.trim() }).toArray();
        if (collList.length === 0) {
            return res.status(400).json({ error: `Collection "${collection}" does not exist` });
        }

        // Validate pipeline
        if (!Array.isArray(pipeline) || pipeline.length === 0) {
            return res.status(400).json({ error: 'Pipeline must be a non-empty array' });
        }

        if (pipeline.length > 20) {
            return res.status(400).json({ error: 'Pipeline too long (max 20 stages)' });
        }

        // Validate each stage
        for (const stage of pipeline) {
            if (typeof stage !== 'object' || stage === null) {
                return res.status(400).json({ error: 'Each pipeline stage must be an object' });
            }
            const stageKeys = Object.keys(stage);
            for (const key of stageKeys) {
                if (BLOCKED_STAGES.includes(key)) {
                    return res.status(403).json({ error: `Stage "${key}" is blocked for security` });
                }
            }
        }

        // Append a $limit at the end if none present
        const hasLimit = pipeline.some(s => '$limit' in s);
        const safePipeline = hasLimit ? pipeline : [...pipeline, { $limit: 1000 }];

        const records = await db.collection(collection.trim()).aggregate(safePipeline).toArray();

        // Flatten for table display
        const flatRecords = records.map(doc => flattenDoc(doc));

        const columnSet = new Set();
        flatRecords.forEach(doc => {
            Object.keys(doc).forEach(k => columnSet.add(k));
        });

        res.json({
            success: true,
            records: flatRecords,
            columns: Array.from(columnSet),
            totalCount: flatRecords.length
        });
    } catch (err) {
        console.error('Aggregate Error:', err.message);
        res.status(500).json({ error: err.message || 'Error executing aggregate' });
    }
});

// ─── API: Get collection count ───────────────────────────────────────────────
app.get('/api/count/:collection', async (req, res) => {
    try {
        const collName = req.params.collection;
        const count = await db.collection(collName).countDocuments();
        res.json({ success: true, collection: collName, count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Start Server ────────────────────────────────────────────────────────────
connectDB().then(() => {
    app.listen(port, () => {
        console.log(`🚀 Server running at http://localhost:${port}`);
    });
});
