# 14 - Complete Commands Guide (A to Z)

**Everything you need to run, from zero to fully deployed.**

Student ID: G21266967

---

## PART 1: Prerequisites (One-Time Setup)

### 1.1 - Install Docker Desktop

```bash
# macOS
brew install --cask docker

# Windows — download from https://www.docker.com/products/docker-desktop
# After install, open Docker Desktop and let it start
```

Verify:
```bash
docker --version
docker compose version
```

### 1.2 - Install Terraform

```bash
# macOS
brew install terraform

# Windows — download from https://developer.hashicorp.com/terraform/downloads
```

Verify:
```bash
terraform --version
```

### 1.3 - Install Azure CLI

```bash
# macOS
brew install azure-cli

# Windows
winget install -e --id Microsoft.AzureCLI
```

Verify:
```bash
az --version
```

### 1.4 - Install Git

```bash
# macOS
brew install git

# Windows — download from https://git-scm.com/download/win
```

Verify:
```bash
git --version
```

---

## PART 2: Run Locally with Docker Compose

### 2.1 - Clone / Navigate to Project

```bash
cd /path/to/Distributed
```

### 2.2 - Start All Services (MySQL)

```bash
docker compose --profile mysql up --build
```

Wait until you see all services are running (health checks pass).

### 2.3 - Test Locally

Open in browser:
```
Joke UI:          http://localhost:4000
Submit UI:        http://localhost:4200
Moderate UI:      http://localhost:4100
Swagger Docs:     http://localhost:4200/docs
RabbitMQ Mgmt:    http://localhost:15672  (guest/guest)
Via Kong - Joke:  http://localhost/joke-ui
Via Kong - Submit: http://localhost/submit-ui
Via Kong - Moderate: http://localhost/moderate-ui
```

### 2.4 - Test the Full Flow

```bash
# 1. Get joke types
curl http://localhost:4000/types

# 2. Submit a joke
curl -X POST http://localhost:4200/submit \
  -H "Content-Type: application/json" \
  -d '{"setup":"Why did the chicken cross the road?","punchline":"To get to the other side","type":"general"}'

# 3. Check moderate UI for pending jokes
curl http://localhost:4100/moderate

# 4. Check RabbitMQ queues
curl -u guest:guest http://localhost:15672/api/queues
```

### 2.5 - Switch to MongoDB

```bash
# Stop current
docker compose --profile mysql down

# Start with MongoDB
DB_TYPE=mongo docker compose --profile mongo up --build
```

### 2.6 - Stop Everything

```bash
docker compose --profile mysql down

# To also delete all data (volumes):
docker compose --profile mysql down -v
```

---

## PART 3: Auth0 OIDC Setup (Optional)

### 3.1 - Create Auth0 Account

1. Go to https://auth0.com and sign up (free tier)
2. Choose a tenant name (e.g., `co3404-jokes`)

### 3.2 - Create Application in Auth0

1. Auth0 Dashboard > **Applications** > **Applications**
2. Click **+ Create Application**
3. Name: `CO3404 Moderate Service`
4. Type: **Regular Web Applications**
5. Click **Create**

### 3.3 - Configure Auth0 URLs

In the application settings tab:

```
Allowed Callback URLs:    http://localhost:4100/callback
Allowed Logout URLs:      http://localhost:4100
Allowed Web Origins:      http://localhost:4100
```

For Azure deployment, add (comma-separated):
```
Allowed Callback URLs:    http://localhost:4100/callback, https://g21266967.duckdns.org/callback
Allowed Logout URLs:      http://localhost:4100, https://g21266967.duckdns.org/moderate-ui
Allowed Web Origins:      http://localhost:4100, https://g21266967.duckdns.org
```

Click **Save Changes**.

### 3.4 - Note Your Credentials

From the Auth0 application settings, copy:
- **Domain** (e.g., `your-tenant.us.auth0.com`)
- **Client ID**
- **Client Secret**

### 3.5 - Create .env File

In the project root:

```bash
cat > .env << 'EOF'
OIDC_CLIENT_ID=your-auth0-client-id-here
OIDC_ISSUER=https://your-tenant.us.auth0.com
OIDC_SECRET=your-auth0-client-secret-here
MODERATE_BASE_URL=http://localhost:4100
EOF
```

### 3.6 - Restart with OIDC Enabled

```bash
docker compose --profile mysql down
docker compose --profile mysql up --build
```

The moderate service will detect the OIDC env vars and enable Auth0 login.

### 3.7 - Test OIDC

1. Open http://localhost:4100
2. Click "Login" — redirects to Auth0
3. Sign up / Log in
4. Redirected back — you can now moderate jokes
5. Click "Logout" to end session

---

## PART 4: Deploy to Azure with Terraform (Multi-Region)

### 4.1 - Login to Azure

```bash
az login
```

This opens a browser — log in with your uni Azure account.

### 4.2 - Set Subscription

```bash
az account set --subscription "e08005f5-750a-4afc-9b45-14073f57a2f2"

# Verify
az account show --query "{name:name, id:id}" -o table
```

### 4.3 - Initialize Terraform

```bash
cd terraform
terraform init
```

### 4.4 - Preview What Will Be Created

```bash
terraform plan
```

This shows: 2 resource groups, 2 VNets, 2 subnets, 2 NSGs, 5 VMs, 5 public IPs, SSH keys.

### 4.5 - Create All Azure Resources

```bash
terraform apply
```

Type `yes` when prompted. Wait 3-5 minutes.

### 4.6 - Save the Output IPs

```bash
# Show all outputs
terraform output

# Get all public IPs
terraform output vm_public_ips

# Get SSH commands for all VMs
terraform output ssh_commands
```

**SAVE THESE IPs** — you need them for GitHub Secrets and deployment.

### 4.7 - Wait for Cloud-Init (2-3 mins)

VMs auto-install Docker. Wait, then verify:

```bash
ssh -i ssh_key.pem azureuser@<KONG_PUBLIC_IP> "docker --version"
```

---

## PART 5: Deploy Services to Azure VMs (Manual)

Run these commands from your local machine. Replace `<IP>` placeholders with actual IPs from `terraform output vm_public_ips`.

### 5.1 - Set Your IPs as Variables

```bash
KONG_IP="<kong-public-ip>"
JOKE_IP="<joke-public-ip>"
RABBITMQ_IP="<rabbitmq-public-ip>"
SUBMIT_IP="<submit-public-ip>"
MODERATE_IP="<moderate-public-ip>"
SSH_KEY="ssh_key.pem"
IMAGE_PREFIX="ghcr.io/<your-github-username>"
```

### 5.2 - Build and Push Docker Images (GHCR)

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u <your-github-username> --password-stdin

# Build all images
docker build -t $IMAGE_PREFIX/joke-service:latest ../services/joke -f ../services/joke/Dockerfile
docker build -t $IMAGE_PREFIX/joke-etl:latest ../services/joke -f ../services/joke/Dockerfile.etl
docker build -t $IMAGE_PREFIX/submit-service:latest ../services/submit
docker build -t $IMAGE_PREFIX/moderate-service:latest ../services/moderate
docker build -t $IMAGE_PREFIX/kong-gateway:latest ../services/kong

# Push all images
docker push $IMAGE_PREFIX/joke-service:latest
docker push $IMAGE_PREFIX/joke-etl:latest
docker push $IMAGE_PREFIX/submit-service:latest
docker push $IMAGE_PREFIX/moderate-service:latest
docker push $IMAGE_PREFIX/kong-gateway:latest
```

### 5.3 - Deploy RabbitMQ (East Asia)

```bash
ssh -i $SSH_KEY azureuser@$RABBITMQ_IP << 'EOF'
docker pull rabbitmq:3.12-management-alpine
docker rm -f rabbitmq 2>/dev/null || true
docker run -d --name rabbitmq --restart unless-stopped \
  -p 5672:5672 -p 15672:15672 \
  -v rabbitmq_data:/var/lib/rabbitmq \
  -v /home/azureuser/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro \
  -e RABBITMQ_DEFAULT_USER=<your-rmq-user> \
  -e RABBITMQ_DEFAULT_PASS=<your-rmq-pass> \
  rabbitmq:3.12-management-alpine
EOF
```

Wait 15-20 seconds for RabbitMQ to start.

### 5.4 - Deploy Joke Service + MySQL + ETL (East Asia)

```bash
ssh -i $SSH_KEY azureuser@$JOKE_IP << EOF
docker pull $IMAGE_PREFIX/joke-service:latest
docker pull $IMAGE_PREFIX/joke-etl:latest
docker network create joke-net 2>/dev/null || true

# MySQL
docker rm -f mysql 2>/dev/null || true
docker run -d --name mysql --network joke-net --restart unless-stopped \
  -e MYSQL_ROOT_PASSWORD=rootpassword \
  -e MYSQL_DATABASE=jokedb \
  -e MYSQL_USER=jokeuser \
  -e MYSQL_PASSWORD=jokepassword \
  -v mysql_data:/var/lib/mysql \
  mysql:8.0

echo "Waiting 30s for MySQL to initialize..."
sleep 30

# Joke API
docker rm -f joke-api 2>/dev/null || true
docker run -d --name joke-api --network joke-net --restart unless-stopped \
  -p 4000:3000 \
  -e DB_TYPE=mysql -e DB_HOST=mysql -e DB_PORT=3306 \
  -e DB_USER=jokeuser -e DB_PASSWORD=jokepassword -e DB_NAME=jokedb \
  $IMAGE_PREFIX/joke-service:latest

# ETL Service
docker rm -f joke-etl 2>/dev/null || true
docker run -d --name joke-etl --network joke-net --restart unless-stopped \
  -e DB_TYPE=mysql -e DB_HOST=mysql -e DB_PORT=3306 \
  -e DB_USER=jokeuser -e DB_PASSWORD=jokepassword -e DB_NAME=jokedb \
  -e RABBITMQ_URL=amqp://<rmq-user>:<rmq-pass>@10.0.1.50:5672 \
  $IMAGE_PREFIX/joke-etl:latest
EOF
```

### 5.5 - Deploy Submit Service (Indonesia Central)

```bash
ssh -i $SSH_KEY azureuser@$SUBMIT_IP << EOF
docker pull $IMAGE_PREFIX/submit-service:latest
mkdir -p /home/azureuser/data
docker rm -f submit 2>/dev/null || true
docker run -d --name submit --restart unless-stopped \
  -p 4200:3200 \
  -v /home/azureuser/data:/data \
  -e RABBITMQ_URL=amqp://<rmq-user>:<rmq-pass>@$RABBITMQ_IP:5672 \
  -e JOKE_SERVICE_URL=http://$JOKE_IP:4000 \
  -e TYPES_CACHE_FILE=/data/types-cache.json \
  $IMAGE_PREFIX/submit-service:latest
EOF
```

### 5.6 - Deploy Moderate Service with OIDC + RBAC (Indonesia Central)

```bash
ssh -i $SSH_KEY azureuser@$MODERATE_IP << EOF
docker pull $IMAGE_PREFIX/moderate-service:latest
mkdir -p /home/azureuser/data
docker rm -f moderate 2>/dev/null || true
docker run -d --name moderate --restart unless-stopped \
  -p 4100:3100 \
  -v /home/azureuser/data:/data \
  -e RABBITMQ_URL=amqp://<rmq-user>:<rmq-pass>@$RABBITMQ_IP:5672 \
  -e TYPES_CACHE_FILE=/data/types-cache.json \
  -e OIDC_CLIENT_ID=your-auth0-client-id \
  -e OIDC_ISSUER=https://your-tenant.us.auth0.com \
  -e OIDC_SECRET=your-auth0-client-secret \
  -e ALLOWED_MODERATORS=email1@example.com,email2@example.com \
  -e BASE_URL=https://g21266967.duckdns.org \
  -e POST_LOGIN_REDIRECT=/moderate-ui \
  $IMAGE_PREFIX/moderate-service:latest
EOF
```

### 5.7 - Setup SSL + Deploy Kong Gateway (East Asia)

```bash
# Copy and run SSL setup script
scp -i $SSH_KEY ../services/kong/setup-ssl.sh azureuser@$KONG_IP:/home/azureuser/setup-ssl.sh
ssh -i $SSH_KEY azureuser@$KONG_IP "chmod +x /home/azureuser/setup-ssl.sh && bash /home/azureuser/setup-ssl.sh"

# Deploy Kong with SSL
ssh -i $SSH_KEY azureuser@$KONG_IP << EOF
docker pull $IMAGE_PREFIX/kong-gateway:latest
docker rm -f kong 2>/dev/null || true
DOMAIN="g21266967.duckdns.org"
CERT_DIR="/etc/letsencrypt/live/\${DOMAIN}"
docker run -d --name kong --restart unless-stopped \
  -p 80:8000 -p 443:8443 \
  --add-host=joke:10.0.1.20 \
  --add-host=rabbitmq:10.0.1.50 \
  --add-host=submit:$SUBMIT_IP \
  --add-host=moderate:$MODERATE_IP \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  -e KONG_SSL_CERT=\${CERT_DIR}/fullchain.pem \
  -e KONG_SSL_CERT_KEY=\${CERT_DIR}/privkey.pem \
  $IMAGE_PREFIX/kong-gateway:latest
EOF
```

### 5.8 - Verify Deployment

```
Access URLs (HTTPS):
  Joke UI:     https://g21266967.duckdns.org/joke-ui
  Submit UI:   https://g21266967.duckdns.org/submit-ui
  Moderate UI: https://g21266967.duckdns.org/moderate-ui
  API Docs:    https://g21266967.duckdns.org/docs
  RabbitMQ:    https://g21266967.duckdns.org/rmq
```

---

## PART 6: CI/CD Pipeline Setup (GitHub Actions)

> **Note:** If your uni account doesn't support GitHub Actions, skip this part. Use Part 5 (manual deployment) instead.

### 6.1 - Create GitHub Repo

```bash
# From project root (not terraform/)
cd /path/to/Distributed

git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/co3404-distributed.git
git push -u origin main
```

### 6.2 - Add GitHub Secrets

Go to GitHub repo > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**

Add these one by one:

| Secret Name | Value |
|-------------|-------|
| `KONG_PUBLIC_IP` | Kong VM public IP |
| `JOKE_PUBLIC_IP` | Joke VM public IP |
| `RABBITMQ_PUBLIC_IP` | RabbitMQ VM public IP |
| `SUBMIT_PUBLIC_IP` | Submit VM public IP |
| `MODERATE_PUBLIC_IP` | Moderate VM public IP |
| `SSH_PRIVATE_KEY` | Full contents of `terraform/ssh_key.pem` |
| `RABBITMQ_USER` | RabbitMQ username |
| `RABBITMQ_PASS` | RabbitMQ password |
| `OIDC_CLIENT_ID` | Auth0 Client ID |
| `OIDC_ISSUER` | Auth0 Issuer URL |
| `OIDC_SECRET` | Auth0 Client Secret |
| `ALLOWED_MODERATORS` | Comma-separated moderator emails |

### 6.3 - Trigger the Pipeline

**Option A — Push a change:**
```bash
git add .
git commit -m "Trigger deployment"
git push origin main
```

**Option B — Manual trigger:**
Go to GitHub > **Actions** tab > select workflow > **Run workflow**

### 6.4 - Monitor

Go to GitHub > **Actions** tab > click running workflow > watch jobs.

---

## PART 7: Useful Commands

### Check Running Containers on a VM

```bash
ssh -i ssh_key.pem azureuser@<VM_IP> "docker ps"
```

### View Logs of a Container

```bash
ssh -i ssh_key.pem azureuser@<VM_IP> "docker logs -f <container-name>"

# Examples:
ssh -i ssh_key.pem azureuser@$KONG_IP "docker logs kong"
ssh -i ssh_key.pem azureuser@$JOKE_IP "docker logs joke-api"
ssh -i ssh_key.pem azureuser@$RABBITMQ_IP "docker logs rabbitmq"
```

### Restart a Container

```bash
ssh -i ssh_key.pem azureuser@<VM_IP> "docker restart <container-name>"
```

### Start/Stop All VMs

```bash
# Start all VMs (uses start.sh script)
bash start.sh

# Stop all VMs (uses stop.sh script)
bash stop.sh
```

### Stop a Service (Resilience Testing)

```bash
# Stop submit to show joke service still works
ssh -i ssh_key.pem azureuser@$SUBMIT_IP "docker stop submit"

# Start it back
ssh -i ssh_key.pem azureuser@$SUBMIT_IP "docker start submit"
```

---

## PART 8: Destroy Everything (Save Azure Credits)

```bash
cd terraform
terraform destroy
```

Type `yes` when prompted. This removes ALL resources in BOTH regions.

**IMPORTANT:** Always destroy when not using. VMs cost money even when idle. Alternatively, use `stop.sh` to deallocate VMs without destroying infrastructure.

---

## Quick Reference

| What | Command |
|------|---------|
| Start locally (MySQL) | `docker compose --profile mysql up --build` |
| Start locally (MongoDB) | `DB_TYPE=mongo docker compose --profile mongo up --build` |
| Stop locally | `docker compose --profile mysql down` |
| Stop + delete data | `docker compose --profile mysql down -v` |
| Login to Azure | `az login` |
| Create Azure infra | `cd terraform && terraform init && terraform apply` |
| Get all VM IPs | `terraform output vm_public_ips` |
| SSH to any VM | `ssh -i ssh_key.pem azureuser@<IP>` |
| Start all VMs | `bash start.sh` |
| Stop all VMs | `bash stop.sh` |
| Destroy Azure infra | `terraform destroy` |
| Push to GitHub | `git add . && git commit -m "msg" && git push` |
