#!/bin/bash
# Azure Deployment Script
# Student ID: G21266967

set -e

echo "=========================================="
echo "  CO3404 Deployment Script"
echo "=========================================="

# Configuration
cd "$(dirname "$0")/.."
PROJECT_DIR=$(pwd)
TERRAFORM_DIR="$PROJECT_DIR/terraform"
SSH_KEY="$TERRAFORM_DIR/ssh_key.pem"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

# Get Kong public IP from Terraform
cd "$TERRAFORM_DIR"
KONG_IP=$(terraform output -raw kong_public_ip 2>/dev/null || echo "")

if [ -z "$KONG_IP" ]; then
    echo "ERROR: Could not get Kong IP. Run 'terraform apply' first."
    exit 1
fi

echo "Kong Public IP: $KONG_IP"
echo ""

# Build Docker images
echo "Building Docker images..."
cd "$PROJECT_DIR"

docker build -t joke-service:latest ./services/joke -f ./services/joke/Dockerfile
docker build -t joke-etl:latest ./services/joke -f ./services/joke/Dockerfile.etl
docker build -t submit-service:latest ./services/submit
docker build -t moderate-service:latest ./services/moderate
docker build -t kong-gateway:latest ./services/kong

echo "Images built"
echo ""

# Save images
echo "Saving images to tar files..."
mkdir -p /tmp/images
docker save joke-service:latest joke-etl:latest | gzip > /tmp/images/joke.tar.gz
docker save submit-service:latest | gzip > /tmp/images/submit.tar.gz
docker save moderate-service:latest | gzip > /tmp/images/moderate.tar.gz
docker save kong-gateway:latest | gzip > /tmp/images/kong.tar.gz

echo "Images saved"
echo ""

# Transfer images to Kong
echo "Transferring images to Kong VM..."
scp $SSH_OPTS /tmp/images/*.tar.gz azureuser@$KONG_IP:/home/azureuser/
echo "Images transferred"
echo ""

# Deploy RabbitMQ
echo "Deploying RabbitMQ..."
# Copy RabbitMQ config to Kong VM first, then to RabbitMQ VM
scp $SSH_OPTS $PROJECT_DIR/services/rabbitmq/rabbitmq.conf azureuser@$KONG_IP:/home/azureuser/rabbitmq.conf
ssh $SSH_OPTS azureuser@$KONG_IP << 'OUTER'
scp -o StrictHostKeyChecking=no /home/azureuser/rabbitmq.conf azureuser@10.0.1.50:/home/azureuser/rabbitmq.conf
ssh -o StrictHostKeyChecking=no azureuser@10.0.1.50 << 'INNER'
docker rm -f rabbitmq 2>/dev/null || true
docker run -d --name rabbitmq --restart unless-stopped \
  -p 5672:5672 -p 15672:15672 \
  -v rabbitmq_data:/var/lib/rabbitmq \
  -v /home/azureuser/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro \
  -e RABBITMQ_DEFAULT_USER=guest \
  -e RABBITMQ_DEFAULT_PASS=guest \
  rabbitmq:3.12-management-alpine
INNER
OUTER
echo "RabbitMQ deployed"
echo ""

# Deploy Joke Service
echo "Deploying Joke Service..."
ssh $SSH_OPTS azureuser@$KONG_IP << 'OUTER'
scp -o StrictHostKeyChecking=no /home/azureuser/joke.tar.gz azureuser@10.0.1.20:/home/azureuser/
ssh -o StrictHostKeyChecking=no azureuser@10.0.1.20 << 'INNER'
docker load < /home/azureuser/joke.tar.gz
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

echo "Waiting for MySQL to initialize..."
sleep 30

# Joke API
docker rm -f joke-api 2>/dev/null || true
docker run -d --name joke-api --network joke-net --restart unless-stopped \
  -p 4000:3000 \
  -e DB_TYPE=mysql -e DB_HOST=mysql -e DB_PORT=3306 \
  -e DB_USER=jokeuser -e DB_PASSWORD=jokepassword -e DB_NAME=jokedb \
  joke-service:latest

# ETL
docker rm -f joke-etl 2>/dev/null || true
docker run -d --name joke-etl --network joke-net --restart unless-stopped \
  -e DB_TYPE=mysql -e DB_HOST=mysql -e DB_PORT=3306 \
  -e DB_USER=jokeuser -e DB_PASSWORD=jokepassword -e DB_NAME=jokedb \
  -e RABBITMQ_URL=amqp://guest:guest@10.0.1.50:5672 \
  joke-etl:latest
INNER
OUTER
echo "Joke Service deployed"
echo ""

# Deploy Submit Service
echo "Deploying Submit Service..."
ssh $SSH_OPTS azureuser@$KONG_IP << 'OUTER'
scp -o StrictHostKeyChecking=no /home/azureuser/submit.tar.gz azureuser@10.0.1.30:/home/azureuser/
ssh -o StrictHostKeyChecking=no azureuser@10.0.1.30 << 'INNER'
docker load < /home/azureuser/submit.tar.gz
mkdir -p /home/azureuser/data
docker rm -f submit 2>/dev/null || true
docker run -d --name submit --restart unless-stopped \
  -p 4200:3200 \
  -v /home/azureuser/data:/data \
  -e RABBITMQ_URL=amqp://guest:guest@10.0.1.50:5672 \
  -e JOKE_SERVICE_URL=http://10.0.1.20:4000 \
  -e TYPES_CACHE_FILE=/data/types-cache.json \
  submit-service:latest
INNER
OUTER
echo "Submit Service deployed"
echo ""

# Deploy Moderate Service
echo "Deploying Moderate Service..."
ssh $SSH_OPTS azureuser@$KONG_IP << 'OUTER'
scp -o StrictHostKeyChecking=no /home/azureuser/moderate.tar.gz azureuser@10.0.1.40:/home/azureuser/
ssh -o StrictHostKeyChecking=no azureuser@10.0.1.40 << 'INNER'
docker load < /home/azureuser/moderate.tar.gz
mkdir -p /home/azureuser/data
docker rm -f moderate 2>/dev/null || true
docker run -d --name moderate --restart unless-stopped \
  -p 4100:3100 \
  -v /home/azureuser/data:/data \
  -e RABBITMQ_URL=amqp://guest:guest@10.0.1.50:5672 \
  -e TYPES_CACHE_FILE=/data/types-cache.json \
  -e OIDC_CLIENT_ID=\${OIDC_CLIENT_ID} \
  -e OIDC_ISSUER=\${OIDC_ISSUER} \
  -e OIDC_SECRET=\${OIDC_SECRET} \
  -e BASE_URL=http://\${KONG_PUBLIC_IP} \
  moderate-service:latest
INNER
OUTER
echo "Moderate Service deployed"
echo ""

# Deploy Kong Gateway
echo "Deploying Kong Gateway..."
ssh $SSH_OPTS azureuser@$KONG_IP << 'INNER'
docker load < /home/azureuser/kong.tar.gz
docker rm -f kong 2>/dev/null || true
docker run -d --name kong --restart unless-stopped \
  -p 80:8000 -p 443:8443 \
  --add-host=joke:10.0.1.20 \
  --add-host=submit:10.0.1.30 \
  --add-host=moderate:10.0.1.40 \
  --add-host=rabbitmq:10.0.1.50 \
  kong-gateway:latest
INNER
echo "Kong Gateway deployed"
echo ""

echo "=========================================="
echo "  Deployment Complete!"
echo "=========================================="
echo ""
echo "Access URLs:"
echo "  Joke UI:     http://$KONG_IP/joke-ui"
echo "  Submit UI:   http://$KONG_IP/submit-ui"
echo "  Moderate UI: http://$KONG_IP/moderate-ui"
echo "  API Docs:    http://$KONG_IP/docs"
echo "  RabbitMQ:    http://$KONG_IP/rmq (guest/guest)"
echo ""
echo "SSH Access:"
echo "  ssh -i terraform/ssh_key.pem azureuser@$KONG_IP"
echo ""
