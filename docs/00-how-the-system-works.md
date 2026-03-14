# How The Whole System Works

**Student ID:** G21266967

This is a complete end-to-end walkthrough of the system — from a user submitting a joke to it appearing in the database and back on screen.

---

## The Big Picture

There are 5 microservices, 1 message broker, and 1 or 2 databases, accessible via HTTPS through a DuckDNS domain:

```
USER BROWSER
    |
    v
[Kong API Gateway]  <-- single entry point, HTTPS via Let's Encrypt
[https://g21266967.duckdns.org]
    |
    +---> [Joke Service]     --> reads jokes from DB, serves Joke UI
    +---> [Submit Service]   --> accepts new jokes, puts on queue
    +---> [Moderate Service] --> moderator reviews jokes (Auth0 + RBAC)
    |
    v
[RabbitMQ]  <-- message broker, 2 queues + 1 fanout exchange
    |
    v
[ETL Service]  --> consumes approved jokes, writes to DB
    |
    v
[MySQL or MongoDB]  <-- switchable via DB_TYPE env var
```

---

## End-to-End: Submitting a Joke

Here is exactly what happens when someone submits a joke, step by step:

### Step 1: User Opens Submit UI

- Browser hits `http://localhost:4200` (or `https://g21266967.duckdns.org/submit-ui` via Kong)
- Submit service serves `public/index.html` as static content
- The UI JavaScript calls `GET /types` to populate the type dropdown
- Submit service tries to fetch types from the Joke service (`GET http://joke:3000/types`)
- If Joke service is down, it reads from its local `types-cache.json` file instead (resilience)

### Step 2: User Fills In and Submits

- User enters setup, punchline, selects or types a type
- Browser sends `POST /submit` with JSON body: `{ setup, punchline, type }`
- Submit service validates all fields are present and long enough
- Submit service publishes the joke as a message to the **`submit` queue** in RabbitMQ
- Returns `201 Created` to the browser

### Step 3: Message Sits in RabbitMQ

- The joke message sits in the `submit` queue
- It is **persistent** (survives RabbitMQ restart because `durable: true`)
- You can see it in RabbitMQ Management UI at `https://g21266967.duckdns.org/rmq`

### Step 4: Moderator Opens Moderate UI

- Moderator visits `https://g21266967.duckdns.org/moderate-ui`
- Auth0 OIDC requires the moderator to **log in** first (redirected to Auth0)
- After login, **RBAC check**: moderator's email must be in the `ALLOWED_MODERATORS` list
- If authorised, the UI JavaScript calls `GET /moderate`
- Moderate service pulls one message from the `submit` queue using `channel.get()`
- The joke appears in the UI for review (Pending Review tab)

### Step 5: Moderator Reviews

- Moderator can **edit** the setup, punchline, or type
- Moderator can **change the type** using the dropdown (populated from types cache)
- Pending count shows queue size + the currently displayed joke
- If no jokes are waiting, the UI shows "No jokes awaiting moderation" and **polls every 3 seconds**

### Step 6: Moderator Approves (or Rejects)

**If Approved:**
- Browser sends `POST /moderated` with the (possibly edited) joke
- Moderate service publishes the joke to the **`moderated` queue** in RabbitMQ
- Decision is saved to **moderation history** (persistent JSON file)
- Moderate service acknowledges (removes) the original message from the `submit` queue
- Next joke is automatically fetched

**If Rejected:**
- Browser sends `POST /reject`
- Decision is saved to **moderation history**
- Moderate service acknowledges the message (removes it from queue)
- Next joke is fetched

### Step 7: ETL Processes the Approved Joke

- ETL service is constantly consuming from the `moderated` queue
- It receives the approved joke message
- It checks if the type already exists in the database:
  - **If type exists:** just inserts the joke
  - **If type is new:** inserts the type first, then the joke, then publishes a **`type_update` event**

### Step 8: Type Update Event (ECST Pattern)

When ETL detects a new type:

- ETL publishes to the `type_update` **fanout exchange**: `{ event: 'type_added', type: 'science' }`
- RabbitMQ fans this out to all bound queues:
  - `submit_type_updates` queue -> Submit service receives it -> updates `types-cache.json`
  - `moderate_type_updates` queue -> Moderate service receives it -> updates `types-cache.json`
- Now both Submit and Moderate have the new type in their dropdowns **without calling the Joke API**
- This is the **Event-Carried State Transfer** pattern — the event carries the data, so subscribers stay in sync

### Step 9: Joke Appears in the System

- The joke is now in the database (MySQL or MongoDB)
- User visits the Joke UI at `https://g21266967.duckdns.org/joke-ui`
- Selects a type, clicks "Get Joke"
- Joke service queries the database: `SELECT ... ORDER BY RAND() LIMIT 1`
- Setup appears, punchline reveals after 3 seconds

---

## How Each Service Connects

```
                    [Kong :80/:443]
                        |
          +-------------+-------------+
          |             |             |
     [Joke :3000]  [Submit :3200] [Moderate :3100]
          |             |             |
          |        [RabbitMQ :5672]   |
          |          /     \          |
          |    submit     moderated   |
          |    queue       queue      |
          |         \     /           |
          |        [ETL]              |
          |          |                |
     [MySQL :3306]   |                |
     or               |                |
     [MongoDB :27017] +-- type_update --+
                      fanout exchange
```

### Service-to-Service Communication

| From | To | Method | Purpose |
|------|----|--------|---------|
| Submit | Joke service | HTTP GET `/types` | Fetch types for dropdown |
| Submit | RabbitMQ | AMQP publish | Send joke to `submit` queue |
| Moderate | RabbitMQ | AMQP get | Pull joke from `submit` queue |
| Moderate | RabbitMQ | AMQP publish | Send approved joke to `moderated` queue |
| ETL | RabbitMQ | AMQP consume | Consume from `moderated` queue |
| ETL | Database | SQL/MongoDB | Write joke + type |
| ETL | RabbitMQ | AMQP publish | Publish `type_update` to fanout exchange |
| Submit | RabbitMQ | AMQP consume | Subscribe to `type_update` events |
| Moderate | RabbitMQ | AMQP consume | Subscribe to `type_update` events |

---

## How Database Switching Works

The `database/index.js` file acts as a factory:

```
DB_TYPE=mysql  -->  loads db-mysql.js  -->  uses mysql2 connection pool
DB_TYPE=mongo  -->  loads db-mongo.js  -->  uses MongoClient
```

Both modules export the **exact same functions** (`getTypes`, `getRandomJokes`, `addJoke`, etc.), so the rest of the code doesn't know or care which database is running.

Docker Compose uses **profiles** to start only one database:
- `--profile mysql` starts the MySQL container
- `--profile mongo` starts the MongoDB container

---

## How Authentication and RBAC Works

When `OIDC_CLIENT_ID` and `OIDC_ISSUER` are set:

1. `express-openid-connect` middleware intercepts requests to protected routes
2. If no valid session -> redirect to Auth0 login page
3. Auth0 handles login (email/password, social login via Google, etc.)
4. Auth0 redirects back to `/callback` with an authorization code
5. The library exchanges the code for tokens, creates a session
6. **RBAC check**: `requiresModerator` middleware verifies user's email is in `ALLOWED_MODERATORS`
7. If email is not allowed -> returns 403 Forbidden
8. If allowed -> `requiresAuth()` middleware on `/moderate`, `/moderated`, `/reject`, `/history` grants access

When env vars are NOT set -> mock auth is used (always authenticated as "Dev Moderator").

---

## How the CI/CD Pipeline Works

On every push to `main`:

```
[GitHub Actions]
    |
    +-- Job 1: Build & Push
    |       Build 5 Docker images
    |       Push to GitHub Container Registry (ghcr.io)
    |
    +-- Job 2: Deploy (Multi-Region)
            SSH directly to each VM's public IP
            Setup SSL certificate (Let's Encrypt)
            Pull images, stop old containers, start new ones
            East Asia: RabbitMQ -> Joke+MySQL+ETL -> Kong
            Indonesia Central: Submit -> Moderate
```

All VMs have public IPs, so the pipeline SSHs directly to each one — no jump host needed for deployment. Cross-region services connect via public IPs.

---

## How Terraform Creates the Infrastructure (Multi-Region)

```
terraform apply
    |
    +-- EAST ASIA REGION
    |     +-- Resource Group: co3404-jokes-eastasia
    |     +-- VNet: 10.0.0.0/16, Subnet: 10.0.1.0/24
    |     +-- NSG: Hardened firewall rules
    |     +-- kong-vm     (10.0.1.10) + Public IP  <- API Gateway + SSL
    |     +-- joke-vm     (10.0.1.20) + Public IP  <- Joke+MySQL+ETL
    |     +-- rabbitmq-vm (10.0.1.50) + Public IP  <- Message Broker
    |
    +-- INDONESIA CENTRAL REGION
    |     +-- Resource Group: co3404-jokes-indonesia
    |     +-- VNet: 10.1.0.0/16, Subnet: 10.1.1.0/24
    |     +-- NSG: Hardened firewall rules
    |     +-- submit-vm   (10.1.1.30) + Public IP  <- Submit Service
    |     +-- moderate-vm (10.1.1.40) + Public IP  <- Moderate Service
    |
    +-- SHARED: SSH Key (4096-bit RSA), Cloud-init (Docker install)
```

VMs in the same region communicate via private IPs. VMs across regions communicate via public IPs.

---

## Resilience — What Happens When Things Go Down

| Scenario | What Happens |
|----------|-------------|
| Joke service stops | Submit UI still works — types loaded from cache file |
| Submit service stops | Joke UI still works — reads from DB directly |
| Moderate service stops | Submitted jokes queue up in RabbitMQ, nothing is lost |
| RabbitMQ stops | Submit returns 503 — but Joke UI still works |
| ETL stops | Approved jokes queue up in `moderated` queue, processed when ETL restarts |
| Database stops | Joke service returns 500 — but Submit and Moderate still work (queue-based) |
| Kong stops | Direct access to services still works via their ports |

Key resilience features:
- **Durable queues** — messages survive RabbitMQ restart
- **Persistent volumes** — database data survives container restart
- **Types cache files** — services work offline using cached data
- **Retry logic** — all services retry RabbitMQ connection 10 times with 5s delay
- **Health checks** — Docker restarts unhealthy containers automatically
- **Rate limiting** — Kong protects all services from abuse/DDoS
- **Security headers** — X-Frame-Options, XSS Protection, Content-Type-Options
