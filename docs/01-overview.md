 # CO3404 - Project Overview

**Student ID:** G21266967
**Module:** CO3404 Distributed Systems
**Target Grade:** Very High 1st / Exceptional 1st

---

## Project Summary

A distributed microservices-based joke application deployed on Azure VMs across 2 regions, featuring:

- **5 microservices:** Joke, Submit, Moderate, ETL, Kong API Gateway
- **2 databases:** MySQL and MongoDB (switchable via environment variable)
- **Message broker:** RabbitMQ with ECST (Event-Carried State Transfer) pattern
- **API Gateway:** Kong with rate limiting, CORS, request size limiting, and security headers
- **Authentication:** Auth0 OIDC with RBAC (Role-Based Access Control) on the Moderate service
- **HTTPS:** Let's Encrypt SSL certificate via DuckDNS domain
- **Infrastructure as Code:** Terraform for multi-region Azure VM provisioning
- **CI/CD:** GitHub Actions with GitHub Container Registry (ghcr.io)

**Public URL:** `https://g21266967.duckdns.org`

---

## Architecture Diagram

```
                    Internet
                       |
              Kong API Gateway (HTTPS)
              g21266967.duckdns.org
              Port 80 / 443
                       |
       +---------------+---------------+
       |               |               |
  Joke Service    Submit Service   Moderate Service
  (East Asia)    (Indonesia)      (Indonesia)
  (10.0.1.20)    (public IP)      (public IP)
   Port 4000      Port 4200        Port 4100
       |               |               |
       |          RabbitMQ Broker       |
       |          (10.0.1.50)          |
       |           Port 5672           |
       |               |               |
       +-------+-------+-------+-------+
               |               |
          ETL Service     type_update
          (on Joke VM)    fanout exchange
               |
       MySQL or MongoDB
       (on Joke VM)
```

---

## Message Flow (ECST Pattern)

```
1. User submits joke via Submit UI
   Submit Service --> [submit queue] --> RabbitMQ

2. Moderator reviews joke (requires Auth0 login + RBAC)
   RabbitMQ --> [submit queue] --> Moderate Service (GET /moderate)

3. Moderator approves joke (saved to history)
   Moderate Service (POST /moderated) --> [moderated queue] --> RabbitMQ

4. ETL writes to database
   RabbitMQ --> [moderated queue] --> ETL Service --> Database

5. New type detected - ETL publishes event
   ETL --> [type_update exchange] --> RabbitMQ (fanout)

6. Submit + Moderate update their caches
   RabbitMQ --> Submit Service (updates types-cache.json)
   RabbitMQ --> Moderate Service (updates types-cache.json)
```

---

## Grade Requirements Mapping

| Requirement                          | Grade Band       | Doc Reference |
|--------------------------------------|------------------|---------------|
| Joke + Submit apps, Docker           | Option 1 (3rd)   | [02-joke-service](02-joke-service.md), [03-submit-service](03-submit-service.md) |
| Azure VMs, RabbitMQ, ETL, cache      | Option 2 (2:2)   | [04-rabbitmq-etl](04-rabbitmq-etl.md), [09-terraform](09-terraform.md) |
| Kong API Gateway, rate limiting      | Option 3 (2:1)   | [05-kong-api-gateway](05-kong-api-gateway.md) |
| Moderate service + ECST              | Low 1st          | [06-moderate-service](06-moderate-service.md) |
| Dual DB (MySQL + MongoDB)            | Mid 1st          | [08-dual-database](08-dual-database.md) |
| CD pipeline (GitHub Actions)         | High 1st         | [10-cicd-pipeline](10-cicd-pipeline.md) |
| OIDC authentication (Auth0)          | Very High 1st    | [07-auth0-oidc](07-auth0-oidc.md) |
| Professional UIs + quality report    | Exceptional 1st  | [12-video-demo-guide](12-video-demo-guide.md) |

---

## Documentation Index

| # | File | Contents |
|---|------|----------|
| 00 | [00-how-the-system-works.md](00-how-the-system-works.md) | Complete end-to-end system walkthrough |
| 01 | [01-overview.md](01-overview.md) | This file |
| 02 | [02-joke-service.md](02-joke-service.md) | Joke service: API, UI, database layer |
| 03 | [03-submit-service.md](03-submit-service.md) | Submit service: API, Swagger, UI |
| 04 | [04-rabbitmq-etl.md](04-rabbitmq-etl.md) | RabbitMQ broker and ETL service |
| 05 | [05-kong-api-gateway.md](05-kong-api-gateway.md) | Kong API Gateway configuration |
| 06 | [06-moderate-service.md](06-moderate-service.md) | Moderate service: queues, UI, RBAC, history |
| 07 | [07-auth0-oidc.md](07-auth0-oidc.md) | Auth0 OIDC authentication + RBAC setup |
| 08 | [08-dual-database.md](08-dual-database.md) | MySQL and MongoDB switching |
| 09 | [09-terraform.md](09-terraform.md) | Terraform Azure infrastructure |
| 10 | [10-cicd-pipeline.md](10-cicd-pipeline.md) | GitHub Actions CI/CD pipeline |
| 11 | [11-docker-compose.md](11-docker-compose.md) | Docker Compose configuration |
| 12 | [12-video-demo-guide.md](12-video-demo-guide.md) | Video presentation guide |
| 13 | [13-troubleshooting.md](13-troubleshooting.md) | Common issues and fixes |
| 14 | [14-complete-commands-guide.md](14-complete-commands-guide.md) | Complete A-Z commands guide |

---

## Quick Start (Local Development)

```bash
# With MySQL
docker compose --profile mysql up --build

# With MongoDB
DB_TYPE=mongo docker compose --profile mongo up --build
```

**Access (Local):**
- Joke UI: http://localhost:4000
- Submit UI: http://localhost:4200
- Moderate UI: http://localhost:4100
- RabbitMQ Management: http://localhost:15672 (guest/guest)

**Access (Azure - via Kong HTTPS):**
- Joke UI: https://g21266967.duckdns.org/joke-ui
- Submit UI: https://g21266967.duckdns.org/submit-ui
- Moderate UI: https://g21266967.duckdns.org/moderate-ui
- API Docs: https://g21266967.duckdns.org/docs
- RabbitMQ: https://g21266967.duckdns.org/rmq
