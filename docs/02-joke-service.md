# 02 - Joke Service

**Port:** 3000 (mapped to 4000 in Docker Compose)
**Location:** `services/joke/`

---

## What It Does

The Joke service is the main data-serving microservice. It stores jokes in a database (MySQL or MongoDB) and provides a REST API and web UI for retrieving random jokes by type.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/joke/:type` | Get 1 random joke of the given type |
| `GET` | `/joke/:type?count=N` | Get N random jokes of the given type |
| `GET` | `/joke/any` | Get 1 random joke of any type |
| `GET` | `/joke/any?count=3` | Get 3 random jokes of any type |
| `GET` | `/types` | Get all unique joke types (no duplicates) |
| `GET` | `/health` | Health check |
| `GET` | `/` | Serve the Joke UI |

---

## Key Files

| File | Purpose |
|------|---------|
| `app.js` | Express server, API routes, serves static UI |
| `database/index.js` | Abstraction layer - loads MySQL or MongoDB module based on `DB_TYPE` |
| `database/db-mysql.js` | MySQL implementation with connection pooling |
| `database/db-mongo.js` | MongoDB implementation |
| `public/index.html` | Joke UI - select type, get joke, punchline reveals after 3 seconds |
| `public/script.js` | Frontend JavaScript for the Joke UI |
| `public/styles.css` | Dark-themed responsive CSS |
| `Dockerfile` | Docker image for the Joke API |
| `Dockerfile.etl` | Docker image for the ETL worker (separate process) |
| `package.json` | Dependencies: express, cors, mysql2, mongodb, amqplib |

---

## How the Database Abstraction Works

`database/index.js` checks the `DB_TYPE` environment variable at startup:

```javascript
const DB_TYPE = (process.env.DB_TYPE || 'mysql').toLowerCase();

if (DB_TYPE === 'mongo' || DB_TYPE === 'mongodb') {
    dbModule = require('./db-mongo');
} else {
    dbModule = require('./db-mysql');
}
```

Both `db-mysql.js` and `db-mongo.js` export the same interface:
- `initialize()` - Connect and create tables/collections + seed data
- `getTypes()` - Return all unique type names
- `getRandomJokes(count)` - Return N random jokes
- `getRandomJokesByType(type, count)` - Return N random jokes of a specific type
- `addJoke(setup, punchline, type)` - Insert a new joke
- `typeExists(typeName)` - Check if a type exists
- `close()` - Close the connection

---

## Database Schema

**MySQL:**
- `types` table: `id` (PK, AUTO_INCREMENT), `name` (UNIQUE), `created_at`
- `jokes` table: `id` (PK), `setup` (TEXT), `punchline` (TEXT), `type_id` (FK -> types.id), `created_at`

**MongoDB:**
- `types` collection: `{ name (unique index), createdAt }`
- `jokes` collection: `{ setup, punchline, type (indexed), createdAt }`

---

## Seed Data

On first run (empty database), the service auto-inserts:
- 5 default types: general, programming, dad, knock-knock, pun
- 6 sample jokes across all types

---

## Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
CMD ["node", "app.js"]
```

---

## UI Features

- Type dropdown dynamically loads from `/types` API
- Refresh button reloads types
- "Get Joke" fetches a random joke
- Setup displayed immediately, punchline reveals after 3 seconds (requirement)
- Shows joke type badge
- Health status indicator in footer

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DB_TYPE` | `mysql` | Database type: `mysql` or `mongo` |
| `DB_HOST` | `mysql` | MySQL hostname |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `jokeuser` | MySQL username |
| `DB_PASSWORD` | `jokepassword` | MySQL password |
| `DB_NAME` | `jokedb` | Database name |
| `MONGO_URL` | `mongodb://mongodb:27017` | MongoDB connection string |

---

## Testing with Postman

```
GET http://localhost:4000/types
GET http://localhost:4000/joke/general
GET http://localhost:4000/joke/any?count=3
GET http://localhost:4000/joke/dad?count=100
GET http://localhost:4000/health
```
