# 11 - Docker Compose Configuration

**File:** `docker-compose.yml`

---

## Services Overview

| Service | Image / Build | Port (host:container) | Profile |
|---------|--------------|----------------------|---------|
| `mysql` | `mysql:8.0` | _(internal only)_ | `mysql` |
| `mongodb` | `mongo:7.0` | _(internal only)_ | `mongo` |
| `rabbitmq` | `rabbitmq:3.12-management-alpine` | `15672:15672` | _(always)_ |
| `joke` | Build `./services/joke` | `4000:3000` | _(always)_ |
| `etl` | Build `./services/joke` (Dockerfile.etl) | _(no port)_ | _(always)_ |
| `submit` | Build `./services/submit` | `4200:3200` | _(always)_ |
| `moderate` | Build `./services/moderate` | `4100:3100` | _(always)_ |
| `kong` | Build `./services/kong` | `80:8000`, `443:8443` | _(always)_ |

---

## Database Profiles

Only one database runs at a time:

```bash
# MySQL (default)
docker compose --profile mysql up --build

# MongoDB
DB_TYPE=mongo docker compose --profile mongo up --build
```

The `DB_TYPE` env var is passed to the Joke and ETL services:
```yaml
environment:
  - DB_TYPE=${DB_TYPE:-mysql}
```

---

## Network

All services share `joke-network` (bridge driver). Services communicate by container name:
- `joke` resolves to the Joke service
- `mysql` resolves to MySQL
- `rabbitmq` resolves to RabbitMQ
- etc.

---

## Volumes (Persistent Data)

| Volume | Mounted To | Purpose |
|--------|-----------|---------|
| `mysql_data` | `/var/lib/mysql` | MySQL data survives restart |
| `mongo_data` | `/data/db` | MongoDB data survives restart |
| `rabbitmq_data` | `/var/lib/rabbitmq` | Queue messages survive restart |
| `submit_data` | `/data` | Submit types cache file |
| `moderate_data` | `/data` | Moderate types cache file |

---

## Health Checks and Dependencies

```yaml
rabbitmq:
  healthcheck:
    test: ["CMD", "rabbitmq-diagnostics", "check_running"]
    interval: 10s

joke:
  depends_on:
    rabbitmq:
      condition: service_healthy

etl:
  depends_on:
    rabbitmq:
      condition: service_healthy
```

Services wait for RabbitMQ to be healthy before starting.

---

## OIDC Configuration

The Moderate service reads Auth0 credentials from environment variables or a `.env` file:

```yaml
moderate:
  environment:
    - OIDC_CLIENT_ID=${OIDC_CLIENT_ID:-}
    - OIDC_ISSUER=${OIDC_ISSUER:-}
    - OIDC_SECRET=${OIDC_SECRET:-}
    - BASE_URL=${MODERATE_BASE_URL:-http://localhost:4100}
```

Create a `.env` file in the project root to enable OIDC:
```bash
OIDC_CLIENT_ID=your-client-id
OIDC_ISSUER=https://your-tenant.auth0.com
OIDC_SECRET=your-client-secret
```

Without the `.env` file, OIDC is disabled and mock auth is used.

---

## Common Commands

```bash
# Start all services with MySQL
docker compose --profile mysql up --build

# Start all services with MongoDB
DB_TYPE=mongo docker compose --profile mongo up --build

# Stop all services
docker compose --profile mysql down

# Stop and remove volumes (reset data)
docker compose --profile mysql down -v

# View logs for a specific service
docker compose logs -f moderate

# Restart a single service
docker compose restart joke

# Stop a single container (for resilience testing)
docker stop joke
docker start joke
```

---

## Access URLs (Local)

| Service | URL |
|---------|-----|
| Joke UI | http://localhost:4000 |
| Submit UI | http://localhost:4200 |
| Moderate UI | http://localhost:4100 |
| Swagger Docs | http://localhost:4200/docs |
| RabbitMQ Management | http://localhost:15672 (guest/guest) |
| Via Kong - Joke | http://localhost/joke-ui |
| Via Kong - Submit | http://localhost/submit-ui |
| Via Kong - Moderate | http://localhost/moderate-ui |
