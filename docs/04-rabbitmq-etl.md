# 04 - RabbitMQ & ETL Service

---

## RabbitMQ Message Broker

**Image:** `rabbitmq:3.12-management-alpine`
**Ports:** 5672 (AMQP), 15672 (Management UI)
**Credentials:** Stored as GitHub Secrets (`RABBITMQ_USER` / `RABBITMQ_PASS`)
**Management UI:** `https://g21266967.duckdns.org/rmq` (via Kong) or `http://localhost:15672` (local)

### Queues

| Queue Name | Durable | Producer | Consumer |
|------------|---------|----------|----------|
| `submit` | Yes | Submit Service | Moderate Service |
| `moderated` | Yes | Moderate Service | ETL Service |

### Exchange

| Exchange Name | Type | Durable | Publisher | Subscribers |
|---------------|------|---------|-----------|-------------|
| `type_update` | fanout | Yes | ETL Service | Submit Service, Moderate Service |

### Message Flow

```
Submit Service
    |
    v
[submit queue] (durable)
    |
    v
Moderate Service (pulls via GET /moderate)
    |
    v (moderator approves)
[moderated queue] (durable)
    |
    v
ETL Service (consumes automatically)
    |
    v
Database (MySQL or MongoDB)
    |
    v (if new type detected)
[type_update exchange] (fanout)
    |
    +---> Submit Service (updates types-cache.json)
    +---> Moderate Service (updates types-cache.json)
```

### Key Features

- **Durable queues:** Messages survive RabbitMQ restart
- **Persistent messages:** Messages written to disk
- **Manual acknowledgment:** Messages only removed after successful processing
- **Fanout exchange:** type_update events broadcast to all subscribers
- **Named queues:** `submit_type_updates` and `moderate_type_updates` for each subscriber
- **Custom credentials:** Secured with non-default username/password (stored as GitHub Secrets)
- **Rate limited:** Kong limits RabbitMQ management UI to 50 requests/min

### RabbitMQ Assets Service (Kong)

The RabbitMQ management UI requires static assets (`/js`, `/css`, `/img`, `/api`). Kong proxies these through a dedicated `rabbitmq-assets` service so the management UI loads correctly when accessed via `https://g21266967.duckdns.org/rmq`.

---

## ETL Service

**Location:** `services/joke/etl.js`
**Dockerfile:** `services/joke/Dockerfile.etl`

The ETL (Extract, Transform, Load) service is a background worker process. It has no HTTP endpoints - it only consumes from the `moderated` RabbitMQ queue and writes jokes to the database.

### What It Does

1. Connects to RabbitMQ with retry logic (10 retries, 5s delay)
2. Consumes messages from the `moderated` queue (1 at a time via prefetch)
3. For each message:
   - Parses the joke (setup, punchline, type)
   - Checks if the type already exists in the database
   - Writes the joke to the database via `db.addJoke()`
   - If the type was new: publishes a `type_update` event to the fanout exchange
   - Acknowledges the message (removes from queue)
4. If processing fails: NACKs the message (returns to queue for retry)

### Type Update Event Format

```json
{
    "event": "type_added",
    "type": "science",
    "timestamp": "2026-02-28T10:30:00.000Z"
}
```

### Key Code (etl.js)

```javascript
async function processMessage(msg) {
    const { setup, punchline, type } = JSON.parse(msg.content.toString());

    const typeExisted = await db.typeExists(type);
    await db.addJoke(setup, punchline, type);

    if (!typeExisted) {
        // New type detected - publish ECST event
        await publishTypeUpdate(type);
    }

    channel.ack(msg);
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_TYPE` | `mysql` | Database: `mysql` or `mongo` |
| `DB_HOST` | `mysql` | MySQL hostname |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `jokeuser` | MySQL username |
| `DB_PASSWORD` | `jokepassword` | MySQL password |
| `DB_NAME` | `jokedb` | Database name |
| `MONGO_URL` | `mongodb://mongodb:27017` | MongoDB connection |
| `RABBITMQ_URL` | `amqp://guest:guest@rabbitmq:5672` | RabbitMQ connection (uses custom creds on Azure) |

### Connection Retry Logic

All services (ETL, Submit, Moderate) use the same pattern:

```javascript
async function connectRabbitMQ(retries = 10) {
    for (let i = 0; i < retries; i++) {
        try {
            connection = await amqp.connect(RABBITMQ_URL);
            channel = await connection.createChannel();
            // ... setup queues and exchanges
            return;
        } catch (e) {
            console.error(`Failed: ${e.message}`);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}
```

This is needed because RabbitMQ takes longer to start than the Node.js services.

---

## Demonstrating in Video

1. Open RabbitMQ Management at `https://g21266967.duckdns.org/rmq`
2. Submit a joke via the Submit UI
3. Show the message appearing in the `submit` queue
4. Moderate the joke (approve it)
5. Show message moving from `submit` to `moderated` queue
6. Show ETL consuming the message (check ETL container logs)
7. Verify the joke is now in the database
8. If it was a new type: show the `type_update` event in exchange stats
