/**
 * Submit Service - Main Application
 * Student ID: G21266967
 *
 * Endpoints:
 *   POST /submit   - Submit a new joke
 *   GET  /types    - Get joke types (from Joke service or cache)
 *   GET  /docs     - Swagger API documentation
 *   GET  /health   - Health check
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const amqp = require('amqplib');
const fs = require('fs').promises;
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
const PORT = process.env.PORT || 3200;

// Configuration
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
const SUBMIT_QUEUE = 'submit';
const TYPE_UPDATE_EXCHANGE = 'type_update';
const JOKE_SERVICE_URL = process.env.JOKE_SERVICE_URL || 'http://joke:3000';
const TYPES_CACHE_FILE = process.env.TYPES_CACHE_FILE || '/data/types-cache.json';

let rabbitConnection;
let rabbitChannel;

// Swagger configuration
const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Submit Service API',
            version: '1.0.0',
            description: 'API for submitting jokes to the CO3404 Distributed Joke System'
        },
        servers: [{ url: `http://localhost:${PORT}` }]
    },
    apis: [__filename]
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { etag: false, lastModified: false, setHeaders: (res) => { res.set('Cache-Control', 'no-store'); } }));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     responses:
 *       200:
 *         description: Service is healthy
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'submit',
        rabbitMQ: rabbitChannel ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

/**
 * @swagger
 * /types:
 *   get:
 *     summary: Get all joke types
 *     description: Returns list of available joke types
 *     responses:
 *       200:
 *         description: List of joke types
 */
app.get('/types', async (req, res) => {
    try {
        // Try to get types from joke service
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${JOKE_SERVICE_URL}/types`, {
            signal: controller.signal
        });
        clearTimeout(timeout);
        
        if (!response.ok) throw new Error('Joke service error');
        
        const types = await response.json();
        await updateTypesCache(types);
        res.json(types);
        
    } catch (error) {
        console.log('Joke service unavailable, using cache');
        try {
            const cached = await readTypesCache();
            res.json(cached);
        } catch (e) {
            res.json(['general', 'programming', 'dad', 'knock-knock', 'pun']);
        }
    }
});

/**
 * @swagger
 * /submit:
 *   post:
 *     summary: Submit a new joke
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [setup, punchline, type]
 *             properties:
 *               setup:
 *                 type: string
 *                 description: The joke setup
 *                 example: "Why do programmers prefer dark mode?"
 *               punchline:
 *                 type: string
 *                 description: The punchline
 *                 example: "Because light attracts bugs!"
 *               type:
 *                 type: string
 *                 description: Joke category
 *                 example: "programming"
 *     responses:
 *       201:
 *         description: Joke submitted successfully
 *       400:
 *         description: Invalid request
 *       503:
 *         description: Queue unavailable
 */
app.post('/submit', async (req, res) => {
    try {
        const { setup, punchline, type } = req.body;

        if (!setup || !punchline || !type) {
            return res.status(400).json({
                error: 'Missing required fields: setup, punchline, and type'
            });
        }

        if (setup.trim().length < 5) {
            return res.status(400).json({ error: 'Setup must be at least 5 characters' });
        }

        if (punchline.trim().length < 3) {
            return res.status(400).json({ error: 'Punchline must be at least 3 characters' });
        }

        const message = {
            setup: setup.trim(),
            punchline: punchline.trim(),
            type: type.trim().toLowerCase(),
            submittedAt: new Date().toISOString()
        };

        if (!rabbitChannel) {
            throw new Error('Message queue not connected');
        }

        rabbitChannel.sendToQueue(
            SUBMIT_QUEUE,
            Buffer.from(JSON.stringify(message)),
            { persistent: true }
        );

        console.log('Joke submitted:', message.setup.substring(0, 30) + '...');

        res.status(201).json({
            success: true,
            message: 'Joke submitted for moderation',
            data: message
        });

    } catch (error) {
        console.error('Error submitting joke:', error);
        res.status(503).json({ error: 'Failed to submit joke. Please try again.' });
    }
});

// Serve UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper functions
async function readTypesCache() {
    const data = await fs.readFile(TYPES_CACHE_FILE, 'utf8');
    return JSON.parse(data);
}

async function updateTypesCache(types) {
    try {
        const dir = path.dirname(TYPES_CACHE_FILE);
        await fs.mkdir(dir, { recursive: true }).catch(() => {});
        await fs.writeFile(TYPES_CACHE_FILE, JSON.stringify(types, null, 2));
        console.log('Types cache updated');
    } catch (error) {
        console.error('Failed to update cache:', error.message);
    }
}

async function connectToRabbitMQ(retries = 10, delay = 5000) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Connecting to RabbitMQ (${i + 1}/${retries})...`);
            rabbitConnection = await amqp.connect(RABBITMQ_URL);
            rabbitChannel = await rabbitConnection.createChannel();

            await rabbitChannel.assertQueue(SUBMIT_QUEUE, { durable: true });

            // Subscribe to type_update exchange (ECST pattern)
            await rabbitChannel.assertExchange(TYPE_UPDATE_EXCHANGE, 'fanout', { durable: true });
            const { queue } = await rabbitChannel.assertQueue('submit_type_updates', {
                exclusive: false,
                durable: true
            });
            await rabbitChannel.bindQueue(queue, TYPE_UPDATE_EXCHANGE, '');

            // Listen for type updates
            rabbitChannel.consume(queue, async (msg) => {
                if (msg) {
                    try {
                        const event = JSON.parse(msg.content.toString());
                        console.log('Type update event:', event);

                        if (event.event === 'type_added' && event.type) {
                            let types = [];
                            try { types = await readTypesCache(); } catch (e) { types = []; }

                            if (!types.includes(event.type)) {
                                types.push(event.type);
                                types.sort();
                                await updateTypesCache(types);
                                console.log(`Added type to cache: ${event.type}`);
                            }
                        }
                        rabbitChannel.ack(msg);
                    } catch (error) {
                        console.error('Error processing type_update:', error);
                        rabbitChannel.nack(msg, false, false);
                    }
                }
            });

            console.log('Connected to RabbitMQ');

            rabbitConnection.on('error', (err) => console.error('RabbitMQ error:', err));
            rabbitConnection.on('close', () => {
                console.log('RabbitMQ closed, reconnecting...');
                rabbitChannel = null;
                setTimeout(() => connectToRabbitMQ(), 5000);
            });

            return;
        } catch (error) {
            console.error(`Connection failed: ${error.message}`);
            if (i < retries - 1) {
                console.log(`Retrying in ${delay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    console.error('Failed to connect to RabbitMQ after retries');
}

async function start() {
    console.log('Starting Submit Service...');

    // Initialize types cache
    try {
        await readTypesCache();
    } catch (error) {
        await updateTypesCache(['general', 'programming', 'dad', 'knock-knock', 'pun']);
    }

    // Connect to RabbitMQ (non-blocking)
    connectToRabbitMQ();

    app.listen(PORT, () => {
        console.log(`Submit service running on port ${PORT}`);
        console.log(`Health: http://localhost:${PORT}/health`);
        console.log(`API Docs: http://localhost:${PORT}/docs`);
        console.log(`UI: http://localhost:${PORT}/`);
    });
}

start();
