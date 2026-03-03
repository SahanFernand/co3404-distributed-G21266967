# 10 - GitHub Actions CI/CD Pipeline (Multi-Region)

**Requirement:** High 1st (76-78%)
**File:** `.github/workflows/deploy.yml`

---

## What It Does

A fully automated Continuous Deployment pipeline for multi-region Azure:

1. **Triggers** on push to `main` branch (or manual dispatch)
2. **Builds** Docker images for all 5 services
3. **Pushes** images to Docker Hub
4. **Deploys** to Azure VMs across 2 regions via SSH

---

## Pipeline Architecture

```
Developer pushes to main
         |
         v
[Job 1: build-and-push]  (ubuntu-latest)
    |-- Checkout code
    |-- Login to Docker Hub
    |-- Build 5 Docker images
    |-- Push all to Docker Hub
         |
         v
[Job 2: deploy]  (needs: build-and-push)
    |-- Setup SSH key + scan all VM public IPs
    |
    |-- SSH to RABBITMQ_PUBLIC_IP:  Deploy RabbitMQ     (East Asia)
    |-- SSH to JOKE_PUBLIC_IP:      Deploy MySQL+Joke+ETL (East Asia)
    |-- SSH to SUBMIT_PUBLIC_IP:    Deploy Submit       (Indonesia Central)
    |-- SSH to MODERATE_PUBLIC_IP:  Deploy Moderate     (Indonesia Central)
    |-- SSH to KONG_PUBLIC_IP:      Deploy Kong         (East Asia)
         |
         v
    All services running across 2 regions
```

**Key difference from single-region:** No more jump host needed for deployment. All VMs have public IPs, so the pipeline SSHs directly to each one.

---

## Step-by-Step Setup

### Step 1 - Docker Hub Account

1. Go to https://hub.docker.com/signup
2. Create account, note your **username**
3. Go to **Account Settings** > **Security** > **New Access Token**
4. Create token with **Read & Write** access
5. Save the token

### Step 2 - Push Code to GitHub

```bash
git init
git remote add origin https://github.com/YOUR_USERNAME/co3404-distributed.git
git add .
git commit -m "Initial commit"
git push -u origin main
```

### Step 3 - Add GitHub Secrets

Go to GitHub repo > **Settings** > **Secrets and variables** > **Actions**

| Secret | Value | Source |
|--------|-------|--------|
| `DOCKER_USERNAME` | Docker Hub username | Docker Hub |
| `DOCKER_PASSWORD` | Docker Hub access token | Docker Hub |
| `KONG_PUBLIC_IP` | Kong VM public IP | `terraform output vm_public_ips` |
| `JOKE_PUBLIC_IP` | Joke VM public IP | `terraform output vm_public_ips` |
| `RABBITMQ_PUBLIC_IP` | RabbitMQ VM public IP | `terraform output vm_public_ips` |
| `SUBMIT_PUBLIC_IP` | Submit VM public IP | `terraform output vm_public_ips` |
| `MODERATE_PUBLIC_IP` | Moderate VM public IP | `terraform output vm_public_ips` |
| `SSH_PRIVATE_KEY` | Full contents of `terraform/ssh_key.pem` | Terraform output |
| `OIDC_CLIENT_ID` | Auth0 Client ID | Auth0 Dashboard |
| `OIDC_ISSUER` | Auth0 Issuer URL | Auth0 Dashboard |
| `OIDC_SECRET` | Auth0 Client Secret | Auth0 Dashboard |

**Note:** You now need 5 public IP secrets (one per VM) instead of just 1.

### Step 4 - Ensure VMs Are Running

```bash
cd terraform
terraform apply
terraform output vm_public_ips  # Copy these to GitHub Secrets
```

Wait 2-3 minutes for cloud-init (Docker installation).

### Step 5 - Trigger Pipeline

**Option A:** Push a change
```bash
git add .
git commit -m "Trigger deployment"
git push origin main
```

**Option B:** Manual trigger via GitHub Actions tab > Run workflow

### Step 6 - Monitor

Go to GitHub > **Actions** tab > click running workflow > watch both jobs.

### Step 7 - Verify

```
Joke UI:      http://<KONG_IP>/joke-ui
Submit UI:    http://<KONG_IP>/submit-ui
Moderate UI:  http://<KONG_IP>/moderate-ui
API Docs:     http://<KONG_IP>/docs
```

---

## Pipeline Details

### Job 1: build-and-push

Builds and pushes 5 images:
- `<username>/joke-service:latest`
- `<username>/joke-etl:latest`
- `<username>/submit-service:latest`
- `<username>/moderate-service:latest`
- `<username>/kong-gateway:latest`

### Job 2: deploy

SSHs directly to each VM's public IP. No jump host needed.

| VM | Region | Public IP Secret | Service | Key Config |
|----|--------|-----------------|---------|------------|
| rabbitmq-vm | East Asia | `RABBITMQ_PUBLIC_IP` | RabbitMQ 3.12 | Ports 5672, 15672 |
| joke-vm | East Asia | `JOKE_PUBLIC_IP` | MySQL + Joke API + ETL | RABBITMQ_URL uses RabbitMQ public IP |
| submit-vm | Indonesia Central | `SUBMIT_PUBLIC_IP` | Submit | Cross-region: RABBITMQ_URL, JOKE_SERVICE_URL |
| moderate-vm | Indonesia Central | `MODERATE_PUBLIC_IP` | Moderate | Cross-region: RABBITMQ_URL + OIDC config |
| kong-vm | East Asia | `KONG_PUBLIC_IP` | Kong | --add-host maps all services to public IPs |

### Cross-Region Service URLs

Services in Indonesia Central connect to East Asia services via public IPs:

```
Submit (Indonesia Central) --> RabbitMQ (East Asia): amqp://guest:guest@<RABBITMQ_PUBLIC_IP>:5672
Submit (Indonesia Central) --> Joke (East Asia):     http://<JOKE_PUBLIC_IP>:4000
Moderate (Indonesia Central) --> RabbitMQ (East Asia): amqp://guest:guest@<RABBITMQ_PUBLIC_IP>:5672
ETL (East Asia) --> RabbitMQ (East Asia):    amqp://guest:guest@<RABBITMQ_PUBLIC_IP>:5672
```

Kong uses `--add-host` to resolve service hostnames to public IPs:
```
--add-host=joke:<JOKE_PUBLIC_IP>
--add-host=submit:<SUBMIT_PUBLIC_IP>
--add-host=moderate:<MODERATE_PUBLIC_IP>
--add-host=rabbitmq:<RABBITMQ_PUBLIC_IP>
```

---

## Video Demo Checklist

1. Show `.github/workflows/deploy.yml` file
2. Show GitHub Secrets (all 5 VM public IPs configured)
3. Make a small code change
4. `git commit` and `git push`
5. Show GitHub Actions tab with pipeline running
6. Show both jobs completing (green checkmarks)
7. Show the deployed app working on Azure
8. (Optional) Show `terraform output` with multi-region info
9. (Optional) Show Docker Hub with pushed images
