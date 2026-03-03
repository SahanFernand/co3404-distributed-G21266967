/**
 * Moderate Service - Main Application
 * Student ID: G21266967
 *
 * Endpoints:
 *   GET  /moderate   - Get next joke for moderation (auth required)
 *   POST /moderated  - Approve moderated joke (auth required)
 *   POST /reject     - Reject joke (auth required)
 *   GET  /types      - Get types from cache
 *   GET  /health     - Health check
 *   GET  /auth/status - Check authentication status
 *
 * This service:
 * - Requires OIDC authentication via Auth0 (Very High 1st requirement)
 * - Consumes from 'submit' queue
 * - Publishes to 'moderated' queue for ETL processing
 * - Subscribes to 'type_update' exchange for ECST pattern
 *
 * OIDC Authentication (Auth0):
 *   When OIDC_CLIENT_ID and OIDC_ISSUER are set, the service requires
 *   Auth0 login to access /moderate and /moderated endpoints.
 *   Unauthenticated users are redirected to Auth0 login page.
 *   After login, Auth0 redirects back to /callback with the auth code.
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const amqp = require('amqplib');
const fs = require('fs').promises;
const session = require('express-session');
const { auth, requiresAuth } = require('express-openid-connect');

const app = express();
const PORT = process.env.PORT || 3100;

// Configuration
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
const SUBMIT_QUEUE = 'submit';
const MODERATED_QUEUE = 'moderated';
const TYPE_UPDATE_EXCHANGE = 'type_update';
const TYPES_CACHE_FILE = process.env.TYPES_CACHE_FILE || '/data/types-cache.json';

let rabbitConnection;
let rabbitChannel;

// OIDC Configuration (Auth0)
// Production: Set OIDC_CLIENT_ID, OIDC_ISSUER, OIDC_SECRET, BASE_URL
// Development: Falls back to mock authentication when env vars are not set
const oidcEnabled = !!(process.env.OIDC_CLIENT_ID && process.env.OIDC_ISSUER);

// Kong routes /login, /logout, /callback at root level to this service
// BASE_URL = http://kong-ip (no subpath) so Auth0 callback = http://kong-ip/callback
// After login, redirect to /moderate-ui (the Kong route for the UI)
const POST_LOGIN_REDIRECT = process.env.POST_LOGIN_REDIRECT || '/moderate-ui';

const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const oidcConfig = {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.OIDC_SECRET || 'a-very-long-secret-value-at-least-32-characters-long!!',
    clientSecret: process.env.OIDC_SECRET,
    baseURL: BASE_URL,
    clientID: process.env.OIDC_CLIENT_ID || 'development-client-id',
    issuerBaseURL: process.env.OIDC_ISSUER || 'https://dev-example.auth0.com',
    routes: {
        login: '/login',
        logout: '/logout',
        callback: '/callback',
        postLogoutRedirect: POST_LOGIN_REDIRECT
    },
    authorizationParams: {
        response_type: 'code',
        scope: 'openid profile email'
    },
    getLoginState: () => {
        // After Auth0 login, redirect to /moderate-ui (Kong gateway route)
        return { returnTo: POST_LOGIN_REDIRECT };
    },
    logoutParams: {
        // After Auth0 logout, redirect back to /moderate-ui
        returnTo: `${BASE_URL}${POST_LOGIN_REDIRECT}`
    }
};

// Trust proxy when running behind Kong API Gateway
app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'moderator-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// OIDC Authentication
if (oidcEnabled) {
    app.use(auth(oidcConfig));
    console.log('OIDC authentication ENABLED via Auth0');
    console.log(`  Issuer: ${process.env.OIDC_ISSUER}`);
    console.log(`  Base URL: ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
} else {
    console.log('OIDC not configured - running in DEVELOPMENT mode with mock auth');
    // Mock authentication middleware for local development
    app.use((req, res, next) => {
        req.oidc = {
            isAuthenticated: () => true,
            user: {
                name: 'Dev Moderator',
                email: 'moderator@dev.local',
                sub: 'dev-user-001'
            }
        };
        next();
    });
}

app.use(express.static(path.join(__dirname, 'public'), { etag: false, lastModified: false, setHeaders: (res) => { res.set('Cache-Control', 'no-store'); } }));

// ============ Public Endpoints ============

/**
 * Health check (public)
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'moderate',
        rabbitMQ: rabbitChannel ? 'connected' : 'disconnected',
        oidc: oidcEnabled ? 'enabled' : 'development-mode',
        timestamp: new Date().toISOString()
    });
});

/**
 * Authentication status (public)
 */
app.get('/auth/status', (req, res) => {
    if (req.oidc && req.oidc.isAuthenticated()) {
        res.json({
            authenticated: true,
            user: {
                name: req.oidc.user.name || req.oidc.user.email,
                email: req.oidc.user.email
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

/**
 * Get types from cache (public)
 */
app.get('/types', async (req, res) => {
    try {
        const types = await readTypesCache();
        res.json(types);
    } catch (error) {
        console.error('Error reading types cache:', error);
        // Return defaults
        res.json(['general', 'programming', 'dad', 'knock-knock', 'pun']);
    }
});

// ============ Protected Endpoints (require authentication) ============

/**
 * Get next joke for moderation
 * Fetches from the 'submit' queue
 */
app.get('/moderate', requiresAuth(), async (req, res) => {
    try {
        if (!rabbitChannel) {
            return res.status(503).json({ error: 'Message queue not available' });
        }

        // Try to get a message from the queue
        const msg = await rabbitChannel.get(SUBMIT_QUEUE, { noAck: false });

        if (msg) {
            const joke = JSON.parse(msg.content.toString());
            // Include delivery tag for later acknowledgment
            joke._deliveryTag = msg.fields.deliveryTag;
            
            console.log('Fetched joke for moderation:', joke.setup.substring(0, 30) + '...');
            
            return res.json({ 
                joke, 
                queueSize: await getQueueSize()
            });
        }

        // No messages in queue
        res.json({ 
            joke: null, 
            message: 'No jokes awaiting moderation',
            queueSize: 0
        });

    } catch (error) {
        console.error('Error fetching joke for moderation:', error);
        res.status(500).json({ error: 'Failed to fetch joke' });
    }
});

/**
 * Submit moderated (approved) joke
 * Publishes to 'moderated' queue for ETL processing
 */
app.post('/moderated', requiresAuth(), async (req, res) => {
    try {
        const { setup, punchline, type, _deliveryTag } = req.body;

        // Validation
        if (!setup || !punchline || !type) {
            return res.status(400).json({
                error: 'Missing required fields: setup, punchline, type'
            });
        }

        // Prepare message for ETL
        const message = {
            setup: setup.trim(),
            punchline: punchline.trim(),
            type: type.trim().toLowerCase(),
            moderatedBy: req.oidc.user?.email || 'unknown',
            moderatedAt: new Date().toISOString()
        };

        // Send to moderated queue
        await sendToQueue(MODERATED_QUEUE, message);

        // Acknowledge the original message (remove from submit queue)
        if (_deliveryTag && rabbitChannel) {
            try {
                rabbitChannel.ack({ fields: { deliveryTag: _deliveryTag } });
                console.log('Original message acknowledged');
            } catch (e) {
                console.log('Could not ack message:', e.message);
            }
        }

        console.log('Joke approved by', req.oidc.user?.email);

        res.json({
            success: true,
            message: 'Joke approved and forwarded for processing'
        });

    } catch (error) {
        console.error('Error submitting moderated joke:', error);
        res.status(500).json({ error: 'Failed to submit moderated joke' });
    }
});

/**
 * Reject a joke (remove from queue without processing)
 */
app.post('/reject', requiresAuth(), async (req, res) => {
    try {
        const { _deliveryTag, reason } = req.body;

        // Acknowledge (remove) the message from queue
        if (_deliveryTag && rabbitChannel) {
            try {
                rabbitChannel.ack({ fields: { deliveryTag: _deliveryTag } });
                console.log('Joke rejected by', req.oidc.user?.email, '- Reason:', reason || 'Not specified');
            } catch (e) {
                console.log('Could not ack message:', e.message);
            }
        }

        res.json({ success: true, message: 'Joke rejected' });

    } catch (error) {
        console.error('Error rejecting joke:', error);
        res.status(500).json({ error: 'Failed to reject joke' });
    }
});

// Serve the main UI page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============ Helper Functions ============

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
        console.error('Failed to update types cache:', error.message);
    }
}

async function sendToQueue(queueName, message) {
    if (!rabbitChannel) {
        throw new Error('RabbitMQ not connected');
    }

    rabbitChannel.sendToQueue(
        queueName,
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
    );

    console.log(`Message sent to ${queueName}`);
}

async function getQueueSize() {
    try {
        if (rabbitChannel) {
            const { messageCount } = await rabbitChannel.checkQueue(SUBMIT_QUEUE);
            return messageCount;
        }
    } catch (e) {
        // Queue might not exist yet
    }
    return 0;
}

/**
 * Connect to RabbitMQ with retry logic
 */
async function connectToRabbitMQ(retries = 10, delay = 5000) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Connecting to RabbitMQ (attempt ${i + 1}/${retries})...`);
            rabbitConnection = await amqp.connect(RABBITMQ_URL);
            rabbitChannel = await rabbitConnection.createChannel();

            // Assert queues
            await rabbitChannel.assertQueue(SUBMIT_QUEUE, { durable: true });
            await rabbitChannel.assertQueue(MODERATED_QUEUE, { durable: true });

            // Subscribe to type_update exchange (ECST pattern)
            await rabbitChannel.assertExchange(TYPE_UPDATE_EXCHANGE, 'fanout', { durable: true });
            const { queue } = await rabbitChannel.assertQueue('moderate_type_updates', {
                exclusive: false,
                durable: true
            });
            await rabbitChannel.bindQueue(queue, TYPE_UPDATE_EXCHANGE, '');

            // Listen for type updates
            rabbitChannel.consume(queue, async (msg) => {
                if (msg) {
                    try {
                        const event = JSON.parse(msg.content.toString());
                        console.log('Received type_update event:', event);

                        if (event.event === 'type_added' && event.type) {
                            let types = [];
                            try {
                                types = await readTypesCache();
                            } catch (e) {
                                types = [];
                            }

                            if (!types.includes(event.type)) {
                                types.push(event.type);
                                types.sort();
                                await updateTypesCache(types);
                                console.log(`Added new type to cache: ${event.type}`);
                            }
                        }

                        rabbitChannel.ack(msg);
                    } catch (error) {
                        console.error('Error processing type_update:', error);
                        rabbitChannel.nack(msg, false, false);
                    }
                }
            });

            console.log('Connected to RabbitMQ successfully');

            rabbitConnection.on('error', (err) => {
                console.error('RabbitMQ error:', err);
            });

            rabbitConnection.on('close', () => {
                console.log('RabbitMQ connection closed, reconnecting...');
                rabbitChannel = null;
                setTimeout(() => connectToRabbitMQ(), 5000);
            });

            return;
        } catch (error) {
            console.error(`RabbitMQ connection failed: ${error.message}`);
            if (i < retries - 1) {
                console.log(`Retrying in ${delay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    console.error('Failed to connect to RabbitMQ after multiple retries');
}

/**
 * Start the server
 */
async function start() {
    console.log('Starting Moderate Service...');

    // Initialize types cache with defaults
    try {
        await readTypesCache();
    } catch (error) {
        await updateTypesCache(['general', 'programming', 'dad', 'knock-knock', 'pun']);
    }

    // Connect to RabbitMQ
    connectToRabbitMQ();

    app.listen(PORT, () => {
        console.log(`Moderate service running on port ${PORT}`);
        console.log(`Health: http://localhost:${PORT}/health`);
        console.log(`UI: http://localhost:${PORT}/`);

        if (!oidcEnabled) {
            console.log('');
            console.log('To enable OIDC authentication, set these environment variables:');
            console.log('   OIDC_CLIENT_ID=your-client-id');
            console.log('   OIDC_ISSUER=https://your-domain.auth0.com');
            console.log('   OIDC_SECRET=your-secret-min-32-chars');
            console.log('   BASE_URL=https://your-public-url');
        }
    });
}

start();
