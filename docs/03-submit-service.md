 # 03 - Submit Service

**Port:** 3200 (mapped to 4200 in Docker Compose)
**Location:** `services/submit/`

---

## What It Does

The Submit service provides a web UI and API for users to submit new jokes. Submitted jokes are published to a RabbitMQ queue for moderation (not written directly to the database). It also provides Swagger API documentation.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/submit` | Submit a new joke (sends to RabbitMQ queue) |
| `GET` | `/types` | Get joke types (from Joke service, falls back to cache) |
| `GET` | `/docs` | Swagger/OpenAPI documentation UI |
| `GET` | `/health` | Health check |
| `GET` | `/` | Serve the Submit UI |

---

## Key Files

| File | Purpose |
|------|---------|
| `app.js` | Express server, Swagger setup, RabbitMQ connection, ECST subscriber |
| `public/index.html` | Submit form UI with type selection and new type input |
| `public/script.js` | Frontend JavaScript - form validation and submission | client side8
| `public/styles.css` | Blue-themed responsive CSS with mobile hamburger menu |
| `Dockerfile` | Docker image |
| `package.json` | Dependencies: express, cors, amqplib, swagger-jsdoc, swagger-ui-express |

---

## Submission Flow

```
1. User fills in setup, punchline, and type
2. Client-side validation (all fields required, minimum lengths)
3. POST /submit with JSON body
4. Server validates: setup (min 5 chars), punchline (min 3 chars), type required
5. Message published to 'submit' queue in RabbitMQ (persistent)
6. Returns 201 Created with success message
```

---

## Types Cache (Resilience Feature)

The submit service needs to display available joke types. It fetches them from the Joke service API, but if the Joke service is down, it falls back to a cached file:

```javascript
// Try Joke service first
const response = await fetch(`${JOKE_SERVICE_URL}/types`);
const types = await response.json();
await updateTypesCache(types);  // Save to file for fallback

// If Joke service is down, use cache
const cached = await readTypesCache();
```

The cache file is stored at `/data/types-cache.json` (Docker volume).

---

## ECST Type Update Subscription

The Submit service subscribes to the `type_update` fanout exchange. When the ETL service detects a new joke type, it publishes an event. Submit receives it and updates its local types cache file:

```javascript
// Subscribe to type_update exchange
await rabbitChannel.assertExchange('type_update', 'fanout', { durable: true });
const { queue } = await rabbitChannel.assertQueue('submit_type_updates', {
    exclusive: false, durable: true
});
await rabbitChannel.bindQueue(queue, 'type_update', '');

// When event received, update cache
rabbitChannel.consume(queue, async (msg) => {
    const event = JSON.parse(msg.content.toString());
    if (event.event === 'type_added') {
        // Add new type to local cache file
    }
});
```

---

## Swagger Documentation

Swagger UI is served at `/docs`. The OpenAPI spec is auto-generated from JSDoc annotations in `app.js`:

```javascript
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
 */
```

---

## Validation Rules

| Field | Rule | Error Code |
|-------|------|------------|
| `setup` | Required, minimum 5 characters | 400 |
| `punchline` | Required, minimum 3 characters | 400 |
| `type` | Required | 400 |
| RabbitMQ not connected | Cannot submit | 503 |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3200` | Server port |
| `RABBITMQ_URL` | `amqp://guest:guest@rabbitmq:5672` | RabbitMQ connection |
| `JOKE_SERVICE_URL` | `http://joke:3000` | Joke service URL for types |
| `TYPES_CACHE_FILE` | `/data/types-cache.json` | Path to types cache file |

---

## Resilience Demo (for Video)

1. Stop the Joke service: `docker stop joke`
2. Open Submit UI - types dropdown still loads (from cache)
3. Submit a joke - goes to RabbitMQ queue
4. Start Joke service: `docker start joke`
5. Types cache refreshes from live API
