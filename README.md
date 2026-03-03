# CO3404 Distributed Systems - Option 4
**Student ID: G21266967**

## Project Overview

Complete distributed joke system with microservices architecture targeting **First Class grade (78%+)**.

## Grade Requirements Met

| Requirement | Feature | Status |
|-------------|---------|--------|
| Low 1st (62%) | Moderate microservice with types cache | Yes |
| Mid 1st (65%) | MySQL AND MongoDB support | Yes |
| High 1st (68%) | Terraform + automated deployment | Yes |
| Very High 1st (72%) | OIDC authentication | Yes |
| Exceptional 1st (78%+) | Professional UIs, complete implementation | Yes |

## Architecture

```
                    ┌─────────────┐
                    │   Client    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    Kong     │ Public IP
                    │   Gateway   │ Ports 80/443
                    └──────┬──────┘
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
┌───▼───┐            ┌─────▼─────┐          ┌────▼────┐
│ Joke  │◄──────────►│  Submit   │          │Moderate │
│Service│            │  Service  │          │ Service │
└───┬───┘            └─────┬─────┘          └────┬────┘
    │                      │                     │
┌───▼───┐            ┌─────▼─────────────────────▼────┐
│MySQL/ │            │           RabbitMQ             │
│MongoDB│            │    (submit, moderated queues)  │
└───────┘            │    (type_update exchange)      │
                     └────────────────────────────────┘
```

## Quick Start (Local Development)

```bash
# Start with MySQL
docker-compose --profile mysql up -d

# OR start with MongoDB
DB_TYPE=mongo docker-compose --profile mongo up -d

# Access:
# Joke UI:     http://localhost:4000
# Submit UI:   http://localhost:4200
# Moderate UI: http://localhost:4100
# API Docs:    http://localhost:4200/docs
# RabbitMQ:    http://localhost:15672 (guest/guest)
```

## Azure Deployment

```bash
# 1. Deploy infrastructure
cd terraform
terraform init
terraform apply

# 2. Wait for VMs to initialize (~3 minutes)

# 3. Deploy services
cd ../scripts
chmod +x deploy.sh
./deploy.sh
```

## Project Structure

```
distributed-jokes/
├── services/
│   ├── joke/           # Joke API + ETL + dual DB
│   ├── submit/         # Submit API + Swagger
│   ├── moderate/       # Moderate API + OIDC
│   └── kong/           # API Gateway
├── terraform/          # Azure infrastructure
├── scripts/            # Deployment automation
├── docker-compose.yml  # Local development
├── database-export-mysql.sql
└── database-export-mongo.json
```

## Configuration

### Database Selection
```bash
# MySQL (default)
DB_TYPE=mysql

# MongoDB
DB_TYPE=mongo
```

### OIDC Authentication (for Very High 1st)
```bash
OIDC_CLIENT_ID=your-client-id
OIDC_ISSUER=https://your-domain.auth0.com
OIDC_SECRET=your-secret-min-32-chars
BASE_URL=https://your-kong-ip/moderate-ui
```

## Video Demo Checklist

1. [ ] Show `terraform apply` creating infrastructure
2. [ ] Run `deploy.sh` script
3. [ ] Submit a joke → Moderate → View in Joke UI
4. [ ] Show RabbitMQ queues (submit, moderated)
5. [ ] Demonstrate type synchronization (ECST pattern)
6. [ ] Show database switching (MySQL → MongoDB)
7. [ ] Demonstrate rate limiting (429 after 20 requests)
8. [ ] Show service resilience (stop one, others work)
9. [ ] Show OIDC login flow (if configured)

## Author

CO3404 Distributed Systems Student
