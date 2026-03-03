/**
 * MongoDB Database Implementation
 * Student ID: G21266967
 */

const { MongoClient } = require('mongodb');

let client, db;

const config = {
    url: process.env.MONGO_URL || 'mongodb://mongodb:27017',
    dbName: process.env.DB_NAME || 'jokedb'
};

async function initialize() {
    client = new MongoClient(config.url);
    await client.connect();
    db = client.db(config.dbName);
    console.log('MongoDB connected');
    
    await db.collection('types').createIndex({ name: 1 }, { unique: true });
    await db.collection('jokes').createIndex({ type: 1 });
    
    const count = await db.collection('types').countDocuments();
    if (count === 0) {
        console.log('Inserting default types...');
        const types = ['general', 'programming', 'dad', 'knock-knock', 'pun'];
        await db.collection('types').insertMany(types.map(name => ({ name, createdAt: new Date() })));
        await insertSampleJokes();
    }
}

async function insertSampleJokes() {
    console.log('Inserting sample jokes...');
    const jokes = [
        { setup: 'Why do programmers prefer dark mode?', punchline: 'Because light attracts bugs!', type: 'programming' },
        { setup: 'Why did the developer go broke?', punchline: 'Because he used up all his cache!', type: 'programming' },
        { setup: 'What do you call a fake noodle?', punchline: 'An impasta!', type: 'dad' },
        { setup: 'Why dont scientists trust atoms?', punchline: 'Because they make up everything!', type: 'general' },
        { setup: 'What do you call a bear with no teeth?', punchline: 'A gummy bear!', type: 'pun' },
        { setup: 'Knock knock. Whos there? Boo. Boo who?', punchline: 'Dont cry, its just a joke!', type: 'knock-knock' }
    ];
    await db.collection('jokes').insertMany(jokes.map(j => ({ ...j, createdAt: new Date() })));
    console.log('Sample jokes inserted');
}

async function getTypes() {
    const types = await db.collection('types').find({}).project({ name: 1, _id: 0 }).sort({ name: 1 }).toArray();
    return types.map(t => t.name);
}

async function getRandomJokes(count) {
    return await db.collection('jokes').aggregate([
        { $sample: { size: count } },
        { $project: { _id: 0, setup: 1, punchline: 1, type: 1 } }
    ]).toArray();
}

async function getRandomJokesByType(typeName, count) {
    return await db.collection('jokes').aggregate([
        { $match: { type: { $regex: new RegExp(`^${typeName}$`, 'i') } } },
        { $sample: { size: count } },
        { $project: { _id: 0, setup: 1, punchline: 1, type: 1 } }
    ]).toArray();
}

async function addJoke(setup, punchline, typeName) {
    await addType(typeName);
    const result = await db.collection('jokes').insertOne({
        setup, punchline, type: typeName.toLowerCase(), createdAt: new Date()
    });
    console.log(`Joke added with ID: ${result.insertedId}`);
    return { id: result.insertedId, setup, punchline, type: typeName };
}

async function addType(typeName) {
    try {
        await db.collection('types').insertOne({ name: typeName.toLowerCase(), createdAt: new Date() });
        return true;
    } catch (e) {
        if (e.code === 11000) return false;
        throw e;
    }
}

async function typeExists(typeName) {
    const count = await db.collection('types').countDocuments({
        name: { $regex: new RegExp(`^${typeName}$`, 'i') }
    });
    return count > 0;
}

async function close() {
    if (client) await client.close();
}

module.exports = { initialize, getTypes, getRandomJokes, getRandomJokesByType, addJoke, addType, typeExists, close };
