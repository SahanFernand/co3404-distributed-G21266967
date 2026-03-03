/**
 * MySQL Database Implementation
 * Student ID: G21266967
 */

const mysql = require('mysql2/promise');

let pool;

const config = {
    host: process.env.DB_HOST || 'mysql',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'jokeuser',
    password: process.env.DB_PASSWORD || 'jokepassword',
    database: process.env.DB_NAME || 'jokedb',
    waitForConnections: true,
    connectionLimit: 10
};

async function initialize() {
    pool = mysql.createPool(config);
    const conn = await pool.getConnection();
    console.log('MySQL connected');
    
    await conn.execute(`
        CREATE TABLE IF NOT EXISTS types (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(50) UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    await conn.execute(`
        CREATE TABLE IF NOT EXISTS jokes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            setup TEXT NOT NULL,
            punchline TEXT NOT NULL,
            type_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (type_id) REFERENCES types(id)
        )
    `);
    
    const [rows] = await conn.execute('SELECT COUNT(*) as count FROM types');
    if (rows[0].count === 0) {
        const types = ['general', 'programming', 'dad', 'knock-knock', 'pun'];
        for (const t of types) {
            await conn.execute('INSERT IGNORE INTO types (name) VALUES (?)', [t]);
        }
        await insertSampleJokes(conn);
    }
    conn.release();
}

async function insertSampleJokes(conn) {
    console.log('Inserting sample jokes...');
    const jokes = [
        { setup: 'Why do programmers prefer dark mode?', punchline: 'Because light attracts bugs!', type: 'programming' },
        { setup: 'Why did the developer go broke?', punchline: 'Because he used up all his cache!', type: 'programming' },
        { setup: 'What do you call a fake noodle?', punchline: 'An impasta!', type: 'dad' },
        { setup: 'Why dont scientists trust atoms?', punchline: 'Because they make up everything!', type: 'general' },
        { setup: 'What do you call a bear with no teeth?', punchline: 'A gummy bear!', type: 'pun' },
        { setup: 'Knock knock. Whos there? Boo. Boo who?', punchline: 'Dont cry, its just a joke!', type: 'knock-knock' }
    ];
    for (const j of jokes) {
        const [typeRes] = await conn.execute('SELECT id FROM types WHERE name = ?', [j.type]);
        if (typeRes.length > 0) {
            await conn.execute('INSERT INTO jokes (setup, punchline, type_id) VALUES (?, ?, ?)',
                [j.setup, j.punchline, typeRes[0].id]);
        }
    }
    console.log('Sample jokes inserted');
}

async function getTypes() {
    const [rows] = await pool.execute('SELECT DISTINCT name FROM types ORDER BY name');
    return rows.map(r => r.name);
}

async function getRandomJokes(count) {
    const [rows] = await pool.query(`
        SELECT j.id, j.setup, j.punchline, t.name as type
        FROM jokes j JOIN types t ON j.type_id = t.id
        ORDER BY RAND() LIMIT ?
    `, [Number(count)]);
    return rows;
}

async function getRandomJokesByType(typeName, count) {
    const [rows] = await pool.query(`
        SELECT j.id, j.setup, j.punchline, t.name as type
        FROM jokes j JOIN types t ON j.type_id = t.id
        WHERE LOWER(t.name) = LOWER(?)
        ORDER BY RAND() LIMIT ?
    `, [typeName, Number(count)]);
    return rows;
}

async function addJoke(setup, punchline, typeName) {
    await addType(typeName);
    const [typeRes] = await pool.execute('SELECT id FROM types WHERE LOWER(name) = LOWER(?)', [typeName]);
    if (typeRes.length === 0) throw new Error(`Type not found: ${typeName}`);
    const [result] = await pool.execute(
        'INSERT INTO jokes (setup, punchline, type_id) VALUES (?, ?, ?)',
        [setup, punchline, typeRes[0].id]
    );
    console.log(`Joke added with ID: ${result.insertId}`);
    return { id: result.insertId, setup, punchline, type: typeName };
}

async function addType(typeName) {
    try {
        await pool.execute('INSERT IGNORE INTO types (name) VALUES (?)', [typeName.toLowerCase()]);
        return true;
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return false;
        throw e;
    }
}

async function typeExists(typeName) {
    const [rows] = await pool.execute(
        'SELECT COUNT(*) as count FROM types WHERE LOWER(name) = LOWER(?)', [typeName]
    );
    return rows[0].count > 0;
}

async function close() {
    if (pool) await pool.end();
}

module.exports = { initialize, getTypes, getRandomJokes, getRandomJokesByType, addJoke, addType, typeExists, close };
