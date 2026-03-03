/**
 * Database Abstraction Layer
 * Student ID: G21266967
 * Switches between MySQL and MongoDB based on DB_TYPE environment variable
 */

const DB_TYPE = (process.env.DB_TYPE || 'mysql').toLowerCase();

let dbModule;

if (DB_TYPE === 'mongo' || DB_TYPE === 'mongodb') {
    console.log('Using MongoDB database');
    dbModule = require('./db-mongo');
} else {
    console.log('Using MySQL database');
    dbModule = require('./db-mysql');
}

module.exports = {
    initialize: () => dbModule.initialize(),
    getTypes: () => dbModule.getTypes(),
    getRandomJokes: (count) => dbModule.getRandomJokes(count),
    getRandomJokesByType: (type, count) => dbModule.getRandomJokesByType(type, count),
    addJoke: (setup, punchline, type) => dbModule.addJoke(setup, punchline, type),
    addType: (typeName) => dbModule.addType(typeName),
    typeExists: (typeName) => dbModule.typeExists(typeName),
    close: () => dbModule.close()
};
