# CO3404 Distributed Systems - Project Report
## Student ID: G21266967

---

## 1. System Overview

A distributed joke management platform deployed across multiple Azure regions. Users browse jokes, submit new ones, and moderators review submissions before they go live. The system demonstrates core distributed systems concepts: message queuing, API gateway routing, multi-region deployment, CI/CD automation, and authentication/authorization.

**Domain:** https://g21266967.duckdns.org

### Architecture Summary

```
User (Browser)
      |
      v
Kong API Gateway (East Asia - 20.239.48.46)
  Port 80/443  |  HTTPS (Let's Encrypt)
      |
      +---> Joke Service (East Asia - 10.0.1.20:4000)
      |         +--- MySQL 8.0 (same VM, Docker network)
      |         +--- ETL Service (same VM, consumes from RabbitMQ)
      |
      +---> Submit Service (Indonesia Central - 10.1.1.30:4200)
      |         +--- Publishes to RabbitMQ 'submit' queue
      |
      +---> Moderate Service (Indonesia Central - 10.1.1.40:4100)
      |         +--- Auth0 OIDC login
      |         +--- Consumes from 'submit' queue
      |         +--- Publishes to 'moderated' queue
      |
      +---> RabbitMQ (East Asia - 10.0.1.50:5672/15672)
                Message broker for async processing
```

### Region Distribution

| Region             | VMs                          | VM Size     |
|--------------------|------------------------------|-------------|
| East Asia          | Kong, Joke (+MySQL+ETL), RabbitMQ | Standard_B1s |
| Indonesia Central  | Submit, Moderate             | Standard_B1s |

---

## 2. Services

### 2.1 Joke Service
- **Purpose:** Serves jokes to end users from MySQL database
- **Port:** 3000 (internal), 4000 (Docker mapped)
- **Database:** MySQL 8.0 with dual-database abstraction (MySQL/MongoDB switchable)
- **Endpoints:**
  - `GET /joke/:type?count=N` - Random jokes by type
  - `GET /types` - All joke categories
  - `GET /health` - Health check
- **Key files:** `services/joke/app.js`, `services/joke/database/`

### 2.2 Submit Service
- **Purpose:** Accepts new joke submissions, publishes to RabbitMQ
- **Port:** 3200 (internal), 4200 (Docker mapped)
- **Features:** Input validation, Swagger API docs, types caching
- **Endpoints:**
  - `POST /submit` - Submit a joke (setup, punchline, type)
  - `GET /types` - Fetches from Joke service, falls back to cache
  - `GET /docs` - Swagger UI
  - `GET /health` - Health check
- **Key files:** `services/submit/app.js`

### 2.3 Moderate Service
- **Purpose:** Moderators review submitted jokes, approve or reject
- **Port:** 3100 (internal), 4100 (Docker mapped)
- **Authentication:** Auth0 OIDC (express-openid-connect)
- **Authorization:** Role-based access control via `ALLOWED_MODERATORS` env var
- **Features:** Pending review tab, moderation history with persistent storage
- **Endpoints:**
  - `GET /moderate` - Fetch next joke from queue (auth + moderator required)
  - `POST /moderated` - Approve joke (sends to ETL via moderated queue)
  - `POST /reject` - Reject joke (removes from queue)
  - `GET /history` - Moderation history (auth + moderator required)
  - `GET /auth/status` - Authentication/authorization status
  - `GET /types` - Joke categories
  - `GET /health` - Health check
- **Key files:** `services/moderate/app.js`, `services/moderate/public/`

### 2.4 ETL Service
- **Purpose:** Extract-Transform-Load pipeline for approved jokes
- **Consumes from:** `moderated` queue
- **Writes to:** MySQL database (via shared database module)
- **Publishes:** `type_update` events to fanout exchange when new joke types are detected
- **Key files:** `services/joke/etl.js`

### 2.5 Kong API Gateway
- **Purpose:** Single entry point, reverse proxy, security layer
- **Port:** 80 (HTTP), 443 (HTTPS with Let's Encrypt)
- **Configuration:** Declarative (kong.yaml)
- **Features:**
  - Rate limiting per service (joke: 60/min, submit: 60/min, moderate: 100/min)
  - CORS restricted to domain and Kong IP
  - Security headers (X-Frame-Options, X-Content-Type-Options, XSS Protection)
  - Request size limiting (1MB max)
  - Path-based routing to all services
- **Key files:** `services/kong/kong.yaml`, `services/kong/Dockerfile`

### 2.6 RabbitMQ
- **Purpose:** Message broker for asynchronous communication
- **Image:** rabbitmq:3.12-management-alpine
- **Queues:**
  - `submit` - New joke submissions (Submit -> Moderate)
  - `moderated` - Approved jokes (Moderate -> ETL)
- **Exchange:** `type_update` (fanout) - ECST pattern for type propagation
- **Management UI:** Accessible at `/rmq` through Kong
- **Key files:** `services/rabbitmq/rabbitmq.conf`

---

## 3. Data Flow

```
1. User submits joke via Submit UI
       |
       v
2. Submit Service validates and publishes to 'submit' queue (RabbitMQ)
       |
       v
3. Moderator logs in via Auth0, fetches joke from 'submit' queue
       |
       +--- Approve: publishes to 'moderated' queue, saves to history
       +--- Reject: acknowledges (removes from queue), saves to history
       |
       v
4. ETL Service consumes from 'moderated' queue
       |
       +--- Inserts joke into MySQL database
       +--- If new type detected: publishes 'type_update' to fanout exchange
       |
       v
5. Submit + Moderate services receive type_update (ECST pattern)
       |--- Update local types cache
       |
       v
6. Joke Service serves jokes from MySQL to users
```

---

## 4. Messaging Patterns

### Point-to-Point (Queues)
- `submit` queue: Submit -> Moderate (one consumer per message)
- `moderated` queue: Moderate -> ETL (one consumer per message)

### Publish-Subscribe (ECST Pattern)
- `type_update` fanout exchange: ETL publishes, Submit + Moderate consume
- When a new joke type is detected during ETL, all services update their type caches
- This implements the Event-Carried State Transfer (ECST) pattern

---

## 5. Authentication and Authorization

### Auth0 OIDC
- **Provider:** Auth0 (express-openid-connect)
- **Flow:** Authorization Code flow with PKCE
- **Scopes:** openid, profile, email
- **Callback URL:** https://g21266967.duckdns.org/callback
- **Post-login redirect:** /moderate-ui

### Role-Based Access Control
- `ALLOWED_MODERATORS` environment variable (comma-separated emails)
- Server-side middleware (`requiresModerator()`) checks email against allowlist
- Client-side handles 403 responses with access denied message
- Empty allowlist permits all authenticated users (development mode)

---

## 6. Infrastructure

### Terraform (IaC)
All Azure resources provisioned via Terraform:
- 2 Resource Groups (East Asia, Indonesia Central)
- 2 Virtual Networks with subnets (10.0.0.0/16, 10.1.0.0/16)
- 2 Network Security Groups with hardened rules
- 5 Linux VMs (Standard_B1s, Ubuntu)
- Public IPs, NICs, SSH keys

**Key files:** `terraform/main.tf`, `terraform/network.tf`, `terraform/vms.tf`, `terraform/kong.tf`

### Network Security Groups (NSG)
- SSH: Allowed for CI/CD deployment
- HTTP/HTTPS (80/443): Only Kong VM
- RabbitMQ (5672/15672): Restricted to known service IPs
- Service ports (4000/4100/4200): Restricted to Kong IP
- Default deny-all for everything else

### HTTPS / TLS
- **Certificate:** Let's Encrypt (free, auto-renewal)
- **Domain:** g21266967.duckdns.org (DuckDNS free DNS)
- **Setup:** Certbot standalone mode, certs mounted into Kong container
- **Script:** `services/kong/setup-ssl.sh`

---

## 7. CI/CD Pipeline

**File:** `.github/workflows/deploy.yml`

### Job 1: Build and Push
- Builds Docker images for all services
- Pushes to GitHub Container Registry (ghcr.io)
- Makes packages public for VM pull access

### Job 2: Deploy to Azure VMs
1. Setup SSH key from GitHub Secrets
2. Deploy RabbitMQ (East Asia)
3. Deploy Joke + MySQL + ETL (East Asia)
4. Deploy Submit (Indonesia Central)
5. Deploy Moderate with OIDC + RBAC (Indonesia Central)
6. Setup/renew SSL certificate (Let's Encrypt)
7. Deploy Kong Gateway (East Asia)

### GitHub Secrets Used
| Secret | Purpose |
|--------|---------|
| SSH_PRIVATE_KEY | VM access |
| KONG_PUBLIC_IP | Kong VM IP |
| JOKE_PUBLIC_IP | Joke VM IP |
| RABBITMQ_PUBLIC_IP | RabbitMQ VM IP |
| SUBMIT_PUBLIC_IP | Submit VM IP |
| MODERATE_PUBLIC_IP | Moderate VM IP |
| RABBITMQ_USER | RabbitMQ auth |
| RABBITMQ_PASS | RabbitMQ auth |
| OIDC_CLIENT_ID | Auth0 client |
| OIDC_ISSUER | Auth0 issuer URL |
| OIDC_SECRET | Auth0 client secret |
| ALLOWED_MODERATORS | Authorized moderator emails |

---

## 8. Frontend UIs

All three UIs share a consistent blue theme (Coursera/Udemy-inspired), responsive design with mobile hamburger menu.

| UI | URL Path | Purpose |
|----|----------|---------|
| Joke UI | /joke-ui | Browse random jokes by category |
| Submit UI | /submit-ui | Submit new jokes |
| Moderate UI | /moderate-ui | Review, approve/reject jokes (auth required) |

### Moderate UI Features
- **Pending Review tab:** Shows current joke for moderation with editable fields
- **History tab:** Shows all past moderation decisions with status badges
- **Stats bar:** Pending count, approved count, rejected count
- **RBAC enforcement:** Non-moderators see "Access denied" message

---

## 9. Docker Configuration

### Images
| Image | Base | Service |
|-------|------|---------|
| joke-service | node:18-alpine | Joke API |
| joke-etl | node:18-alpine | ETL pipeline |
| submit-service | node:18-alpine | Submit API |
| moderate-service | node:18-alpine | Moderate API |
| kong-gateway | kong:3.4 | API Gateway |
| mysql:8.0 | Official | Database |
| rabbitmq:3.12-management-alpine | Official | Message Broker |

### Volumes
- `mysql_data` - MySQL persistence (Joke VM)
- `rabbitmq_data` - RabbitMQ persistence
- `/home/azureuser/data` - Types cache + moderation history (Submit, Moderate VMs)
- `/etc/letsencrypt` - SSL certificates (Kong VM, read-only mount)

---

## 10. Project File Structure

```
.
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD pipeline
├── docs/                       # Documentation
├── services/
│   ├── joke/
│   │   ├── app.js              # Joke API server
│   │   ├── etl.js              # ETL consumer
│   │   ├── database/           # DB abstraction (MySQL/MongoDB)
│   │   │   ├── index.js
│   │   │   ├── db-mysql.js
│   │   │   └── db-mongo.js
│   │   ├── Dockerfile          # Joke API image
│   │   ├── Dockerfile.etl      # ETL image
│   │   ├── package.json
│   │   └── public/             # Joke browse UI
│   ├── submit/
│   │   ├── app.js              # Submit API + Swagger
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── public/             # Submit UI
│   ├── moderate/
│   │   ├── app.js              # Moderate API + OIDC + RBAC
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── public/             # Moderate UI (tabs, history)
│   ├── kong/
│   │   ├── kong.yaml           # Declarative gateway config
│   │   ├── Dockerfile
│   │   └── setup-ssl.sh        # Let's Encrypt certbot
│   └── rabbitmq/
│       └── rabbitmq.conf       # RabbitMQ configuration
├── terraform/
│   ├── main.tf                 # Resource groups
│   ├── providers.tf            # Azure provider
│   ├── variables.tf            # Variables + locals
│   ├── network.tf              # VNets, subnets, NSGs
│   ├── kong.tf                 # Kong VM
│   ├── vms.tf                  # Service VMs (both regions)
│   ├── ssh.tf                  # SSH key generation
│   ├── outputs.tf              # Output values
│   └── cloud-init/
│       └── docker-install.yaml # VM bootstrap
├── docker-compose.yml          # Local development
├── start.sh                    # Start all Azure VMs
├── stop.sh                     # Stop all Azure VMs (deallocate)
├── .gitignore
└── README.md
```

---

## 11. Access URLs

| Service | URL |
|---------|-----|
| Joke UI | https://g21266967.duckdns.org/joke-ui |
| Submit UI | https://g21266967.duckdns.org/submit-ui |
| Moderate UI | https://g21266967.duckdns.org/moderate-ui |
| API Docs (Swagger) | https://g21266967.duckdns.org/docs |
| RabbitMQ Management | https://g21266967.duckdns.org/rmq |
| Joke API | https://g21266967.duckdns.org/joke/any |
| Health (Joke) | https://g21266967.duckdns.org/joke/health* |

---

## 12. VM Management

### Start All VMs
```bash
./start.sh
```

### Stop All VMs (Deallocate - No Charges)
```bash
./stop.sh
```

### Check VM Status
```bash
az vm list -d --output table --query "[].{Name:name, Status:powerState}"
```

---

## 13. Key Design Decisions

1. **Kong as single entry point** - All traffic routed through one gateway, simplifying firewall rules and enabling centralized rate limiting, CORS, and security headers.

2. **RabbitMQ for async processing** - Decouples submission from moderation and database insertion. Provides reliability through persistent messages and acknowledgments.

3. **ECST pattern for type propagation** - When ETL detects a new joke type, it publishes to a fanout exchange. All services update their local caches without polling the database.

4. **Auth0 OIDC** - Industry-standard authentication without building a custom auth system. Supports Google login out of the box.

5. **RBAC via environment variable** - Simple allowlist approach for moderator authorization. Easy to update via GitHub Secrets without code changes.

6. **Multi-region deployment** - Demonstrates geographic distribution across East Asia and Indonesia Central. Services communicate cross-region via public IPs (inter-VNet traffic).

7. **Let's Encrypt for HTTPS** - Free TLS certificates with automated renewal. Certbot runs during CI/CD pipeline.

8. **Moderation history on disk** - JSON file persistence at `/data/moderation-history.json`. Survives container restarts via Docker volume mount. Simple and sufficient for the use case.
