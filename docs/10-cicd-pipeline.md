# 10 - GitHub Actions CI/CD Pipeline (Multi-Region)

**Requirement:** High 1st (76-78%)
**File:** `.github/workflows/deploy.yml`

---

## What It Does

A fully automated Continuous Deployment pipeline for multi-region Azure:

1. **Triggers** on push to `main` branch (or manual dispatch)
2. **Builds** Docker images for all 5 services
3. **Pushes** images to GitHub Container Registry (ghcr.io)
4. **Sets up** SSL certificate via Let's Encrypt (Certbot)
5. **Deploys** to Azure VMs across 2 regions via SSH

---

## Pipeline Architecture

```
Developer pushes to main
         |
         v
[Job 1: build-and-push]  (ubuntu-latest)
    |-- Checkout code
    |-- Login to GitHub Container Registry (ghcr.io)
    |-- Build 5 Docker images
    |-- Push all to GHCR
    |-- Make packages public
         |
         v
[Job 2: deploy]  (needs: build-and-push)
    |-- Setup SSH key + scan all VM public IPs
    |
    |-- SSH to RABBITMQ_PUBLIC_IP:  Deploy RabbitMQ     (East Asia)
    |-- SSH to JOKE_PUBLIC_IP:      Deploy MySQL+Joke+ETL (East Asia)
    |-- SSH to SUBMIT_PUBLIC_IP:    Deploy Submit       (Indonesia Central)
    |-- SSH to MODERATE_PUBLIC_IP:  Deploy Moderate     (Indonesia Central)
    |-- SSH to KONG_PUBLIC_IP:      Setup SSL + Deploy Kong (East Asia)
         |
         v
    All services running across 2 regions (HTTPS)
```

**Key difference from single-region:** No more jump host needed for deployment. All VMs have public IPs, so the pipeline SSHs directly to each one.

---

## Step-by-Step Setup

### Step 1 - Push Code to GitHub

```bash
git init
git remote add origin https://github.com/YOUR_USERNAME/co3404-distributed.git
git add .
git commit -m "Initial commit"
git push -u origin main
```

The pipeline uses GitHub Container Registry (ghcr.io) with `GITHUB_TOKEN` — no Docker Hub account needed.

### Step 2 - Add GitHub Secrets

Go to GitHub repo > **Settings** > **Secrets and variables** > **Actions**

| Secret | Value | Source |
|--------|-------|--------|
| `KONG_PUBLIC_IP` | Kong VM public IP | `terraform output vm_public_ips` |
| `JOKE_PUBLIC_IP` | Joke VM public IP | `terraform output vm_public_ips` |
| `RABBITMQ_PUBLIC_IP` | RabbitMQ VM public IP | `terraform output vm_public_ips` |
| `SUBMIT_PUBLIC_IP` | Submit VM public IP | `terraform output vm_public_ips` |
| `MODERATE_PUBLIC_IP` | Moderate VM public IP | `terraform output vm_public_ips` |
| `SSH_PRIVATE_KEY` | Full contents of `terraform/ssh_key.pem` | Terraform output |
| `RABBITMQ_USER` | RabbitMQ username | Custom credentials |
| `RABBITMQ_PASS` | RabbitMQ password | Custom credentials |
| `OIDC_CLIENT_ID` | Auth0 Client ID | Auth0 Dashboard |
| `OIDC_ISSUER` | Auth0 Issuer URL | Auth0 Dashboard |
| `OIDC_SECRET` | Auth0 Client Secret | Auth0 Dashboard |
| `ALLOWED_MODERATORS` | Comma-separated moderator emails | Your authorised emails |

**Note:** You need 5 public IP secrets (one per VM), RabbitMQ credentials, OIDC config, and RBAC moderator list.

### Step 3 - Ensure VMs Are Running

```bash
cd terraform
terraform apply
terraform output vm_public_ips  # Copy these to GitHub Secrets
```

Wait 2-3 minutes for cloud-init (Docker installation).

### Step 4 - Trigger Pipeline

**Option A:** Push a change
```bash
git add .
git commit -m "Trigger deployment"
git push origin main
```

**Option B:** Manual trigger via GitHub Actions tab > Run workflow

### Step 5 - Monitor

Go to GitHub > **Actions** tab > click running workflow > watch both jobs.

### Step 6 - Verify

```
Joke UI:      https://g21266967.duckdns.org/joke-ui
Submit UI:    https://g21266967.duckdns.org/submit-ui
Moderate UI:  https://g21266967.duckdns.org/moderate-ui
API Docs:     https://g21266967.duckdns.org/docs
RabbitMQ:     https://g21266967.duckdns.org/rmq
```

---

## Pipeline Details

### Job 1: build-and-push

Builds and pushes 5 images to GitHub Container Registry:
- `ghcr.io/<owner>/joke-service:latest`
- `ghcr.io/<owner>/joke-etl:latest`
- `ghcr.io/<owner>/submit-service:latest`
- `ghcr.io/<owner>/moderate-service:latest`
- `ghcr.io/<owner>/kong-gateway:latest`

After pushing, it makes all packages public so VMs can pull without authentication.

### Job 2: deploy

SSHs directly to each VM's public IP. No jump host needed. Includes SSL setup step.

| VM | Region | Public IP Secret | Service | Key Config |
|----|--------|-----------------|---------|------------|
| rabbitmq-vm | East Asia | `RABBITMQ_PUBLIC_IP` | RabbitMQ 3.12 | Custom credentials, ports 5672, 15672 |
| joke-vm | East Asia | `JOKE_PUBLIC_IP` | MySQL + Joke API + ETL | RABBITMQ_URL uses private IP (same VNet) |
| submit-vm | Indonesia Central | `SUBMIT_PUBLIC_IP` | Submit | Cross-region: RABBITMQ_URL via public IP |
| moderate-vm | Indonesia Central | `MODERATE_PUBLIC_IP` | Moderate | Cross-region: RABBITMQ_URL + OIDC + RBAC |
| kong-vm | East Asia | `KONG_PUBLIC_IP` | Kong + SSL | Let's Encrypt cert, --add-host mappings |

### Cross-Region Service URLs

Same-region VMs use private IPs, cross-region use public IPs:

```
ETL (East Asia) --> RabbitMQ (East Asia):           amqp://<user>:<pass>@10.0.1.50:5672  (private)
Submit (Indonesia Central) --> RabbitMQ (East Asia): amqp://<user>:<pass>@<RABBITMQ_PUBLIC_IP>:5672
Submit (Indonesia Central) --> Joke (East Asia):     http://<JOKE_PUBLIC_IP>:4000
Moderate (Indonesia Central) --> RabbitMQ (East Asia): amqp://<user>:<pass>@<RABBITMQ_PUBLIC_IP>:5672
```

Kong uses `--add-host` to resolve service hostnames:
```
--add-host=joke:10.0.1.20         (private, same VNet)
--add-host=rabbitmq:10.0.1.50     (private, same VNet)
--add-host=submit:<SUBMIT_PUBLIC_IP>     (public, cross-region)
--add-host=moderate:<MODERATE_PUBLIC_IP> (public, cross-region)
```

---

## Video Demo Checklist

1. Show `.github/workflows/deploy.yml` file
2. Show GitHub Secrets (all VM public IPs, RabbitMQ, OIDC, RBAC configured)
3. Make a small code change
4. `git commit` and `git push`
5. Show GitHub Actions tab with pipeline running
6. Show both jobs completing (green checkmarks)
7. Show the deployed app working on Azure (HTTPS)
8. (Optional) Show `terraform output` with multi-region info
