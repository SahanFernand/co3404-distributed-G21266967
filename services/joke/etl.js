/**
 * ETL Service - Extract, Transform, Load
 * Student ID: G21266967
 *
 * Consumes from 'moderated' queue
 * Writes jokes to database
 * Publishes type_update events (ECST pattern)
 */

const amqp = require('amqplib');
const db = require('./database');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
const MODERATED_QUEUE = 'moderated';
const TYPE_UPDATE_EXCHANGE = 'type_update';

let connection, channel;

async function connectRabbitMQ(retries = 10) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Connecting to RabbitMQ (${i + 1}/${retries})...`);
            connection = await amqp.connect(RABBITMQ_URL);
            channel = await connection.createChannel();
            
            await channel.assertQueue(MODERATED_QUEUE, { durable: true });
            await channel.assertExchange(TYPE_UPDATE_EXCHANGE, 'fanout', { durable: true });
            
            console.log('Connected to RabbitMQ');
            
            connection.on('error', (err) => console.error('RabbitMQ error:', err));
            connection.on('close', () => {
                console.log('RabbitMQ closed, reconnecting...');
                channel = null;
                setTimeout(() => connectRabbitMQ(), 5000);
            });
            
            return;
        } catch (e) {
            console.error(`Failed: ${e.message}`);
            if (i < retries - 1) {
                console.log(`Retrying in 5 seconds...`);
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }
    throw new Error('Failed to connect to RabbitMQ');
}

async function publishTypeUpdate(typeName) {
    const msg = JSON.stringify({
        event: 'type_added',
        type: typeName,
        timestamp: new Date().toISOString()
    });
    channel.publish(TYPE_UPDATE_EXCHANGE, '', Buffer.from(msg), { persistent: true });
    console.log(`Published type_update: ${typeName}`);
}

async function processMessage(msg) {
    if (!msg) return;
    
    try {
        const { setup, punchline, type } = JSON.parse(msg.content.toString());
        console.log('Processing:', setup.substring(0, 40) + '...');
        
        if (!setup || !punchline || !type) {
            console.error('Invalid message format');
            channel.ack(msg);
            return;
        }
        
        const typeExisted = await db.typeExists(type);
        await db.addJoke(setup, punchline, type);
        
        if (!typeExisted) {
            console.log(`New type detected: ${type}`);
            await publishTypeUpdate(type);
        }
        
        channel.ack(msg);
    } catch (e) {
        console.error('Error processing:', e);
        channel.nack(msg, false, true);
    }
}

async function start() {
    console.log('Starting ETL Service...');

    await db.initialize();
    console.log('Database initialized');
    
    await connectRabbitMQ();
    
    await channel.prefetch(1);
    channel.consume(MODERATED_QUEUE, processMessage, { noAck: false });
    
    console.log('ETL consuming from moderated queue');
    console.log('Publishing to type_update exchange');
}

process.on('SIGINT', async () => {
    console.log('\\nShutting down ETL...');
    try {
        if (channel) await channel.close();
        if (connection) await connection.close();
        await db.close();
    } catch (e) {}
    process.exit(0);
});

start();
