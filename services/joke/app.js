/**
 * Joke Service - Main Application
 * Student ID: G21266967
 *
 * Endpoints:
 *   GET /joke/:type?count=N - Get random joke(s)
 *   GET /types              - Get all joke types
 *   GET /health             - Health check
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { etag: false, lastModified: false, setHeaders: (res) => { res.set('Cache-Control', 'no-store'); } }));

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'joke',
        database: process.env.DB_TYPE || 'mysql',
        timestamp: new Date().toISOString()
    });
});

// Get all types
app.get('/types', async (req, res) => {
    try {
        const types = await db.getTypes();
        res.json(types);
    } catch (error) {
        console.error('Error fetching types:', error);
        res.status(500).json({ error: 'Failed to fetch types' });
    }
});

// Get random joke(s)
app.get('/joke/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const count = parseInt(req.query.count) || 1;

        let jokes;
        if (type.toLowerCase() === 'any') {
            jokes = await db.getRandomJokes(count);
        } else {
            jokes = await db.getRandomJokesByType(type, count);
        }

        if (jokes.length === 0) {
            return res.status(404).json({ error: `No jokes found for type: ${type}` });
        }

        res.json(count === 1 ? jokes[0] : jokes);
    } catch (error) {
        console.error('Error fetching joke:', error);
        res.status(500).json({ error: 'Failed to fetch joke' });
    }
});

// Serve UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
async function start() {
    try {
        console.log('Starting Joke Service...');
        await db.initialize();
        console.log(`Database initialized (${process.env.DB_TYPE || 'mysql'})`);

        app.listen(PORT, () => {
            console.log(`Joke service running on port ${PORT}`);
            console.log(`Health: http://localhost:${PORT}/health`);
            console.log(`UI: http://localhost:${PORT}/`);
        });
    } catch (error) {
        console.error('Failed to start:', error);
        process.exit(1);
    }
}

process.on('SIGINT', async () => {
    console.log('\\nShutting down...');
    await db.close();
    process.exit(0);
});

start();
