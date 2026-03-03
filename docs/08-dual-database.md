 # 08 - Dual Database (MySQL + MongoDB)

**Requirement:** Mid 1st (73-75%)

---

## What Was Implemented

The Joke service and ETL service support both MySQL and MongoDB. The database is selected at startup via the `DB_TYPE` environment variable. Only ONE database container runs at a time, controlled by Docker Compose profiles.

---

## How It Works

### Database Abstraction Layer (`database/index.js`)

```javascript
const DB_TYPE = (process.env.DB_TYPE || 'mysql').toLowerCase();

if (DB_TYPE === 'mongo' || DB_TYPE === 'mongodb') {
    dbModule = require('./db-mongo');
} else {
    dbModule = require('./db-mysql');
}
```

Both `db-mysql.js` and `db-mongo.js` export the exact same interface:

| Function | Description |
|----------|-------------|
| `initialize()` | Connect, create schema, seed data |
| `getTypes()` | Return all type names |
| `getRandomJokes(count)` | Return N random jokes |
| `getRandomJokesByType(type, count)` | Return N random jokes of a type |
| `addJoke(setup, punchline, type)` | Insert joke + create type if needed |
| `typeExists(typeName)` | Check if type exists |
| `close()` | Close connection |

### Docker Compose Profiles

```yaml
mysql:
  image: mysql:8.0
  profiles:
    - mysql

mongodb:
  image: mongo:7.0
  profiles:
    - mongo
```

---

## Running with MySQL

```bash
# Default (DB_TYPE defaults to mysql)
docker compose --profile mysql up --build

# Or explicitly
DB_TYPE=mysql docker compose --profile mysql up --build
```

### MySQL Schema

```sql
CREATE TABLE types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE jokes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setup TEXT NOT NULL,
    punchline TEXT NOT NULL,
    type_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (type_id) REFERENCES types(id)
);
```

Connection pooling with max 10 connections.

---

## Running with MongoDB

```bash
# Tear down MySQL first
docker compose --profile mysql down

# Start with MongoDB
DB_TYPE=mongo docker compose --profile mongo up --build
```

### MongoDB Collections

- `types`: `{ name (unique index), createdAt }`
- `jokes`: `{ setup, punchline, type (indexed), createdAt }`

Uses `$sample` aggregation for random joke selection.

---

## Key Differences Between Implementations

| Feature | MySQL (`db-mysql.js`) | MongoDB (`db-mongo.js`) |
|---------|----------------------|------------------------|
| Connection | `mysql2/promise` connection pool | `MongoClient` single connection |
| Random query | `ORDER BY RAND() LIMIT ?` | `$sample` aggregation |
| Type lookup | FK join `types.id` -> `jokes.type_id` | Direct string field `jokes.type` |
| Unique types | `UNIQUE` constraint + `INSERT IGNORE` | Unique index + catch error code 11000 |
| Case matching | `LOWER()` SQL function | `$regex` with `i` flag |

---

## Environment Variables

| Variable | MySQL | MongoDB |
|----------|-------|---------|
| `DB_TYPE` | `mysql` (default) | `mongo` |
| `DB_HOST` | `mysql` | _(not used)_ |
| `DB_PORT` | `3306` | _(not used)_ |
| `DB_USER` | `jokeuser` | _(not used)_ |
| `DB_PASSWORD` | `jokepassword` | _(not used)_ |
| `DB_NAME` | `jokedb` | `jokedb` |
| `MONGO_URL` | _(not used)_ | `mongodb://mongodb:27017` |

---

## Database Exports

Pre-built exports are provided for both databases:

- `database-export-mysql.sql` - MySQL dump with schema + data
- `database-export-mongo.json` - MongoDB JSON export

---

## Video Demo Checklist

1. Show `DB_TYPE=mysql` in the environment configuration
2. Start services with MySQL profile - show the Joke UI working
3. Submit a joke, verify it appears in MySQL (MySQL Workbench or API)
4. Tear down: `docker compose --profile mysql down`
5. Start with MongoDB: `DB_TYPE=mongo docker compose --profile mongo up --build`
6. Show the Joke service connected to MongoDB (console output)
7. Submit a joke, verify it works with MongoDB
8. Show the `database/index.js` abstraction layer code
