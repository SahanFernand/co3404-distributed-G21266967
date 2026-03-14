# 09 - Terraform Azure Infrastructure (Multi-Region)

**Location:** `terraform/`
**Provider:** AzureRM ~> 3.0
**Regions:** East Asia + Indonesia Central

---

## Why Multi-Region?

Azure subscription limits restrict the number of VMs per region. This deployment splits 5 VMs across 2 regions:

| Region | VMs | Reason |
|--------|-----|--------|
| **East Asia** | Kong, Joke (+MySQL+ETL), RabbitMQ | Core data path — DB, message broker, gateway |
| **Indonesia Central** | Submit, Moderate | UI/interaction services — lighter workload |

All VMs use `Standard_B1s` (1 vCPU, 1 GiB memory).

---

## What It Creates

### East Asia Resources
| Resource | Name | Purpose |
|----------|------|---------|
| Resource Group | `co3404-jokes-eastasia` | Container for East Asia resources |
| Virtual Network | `jokes-vnet-eastasia` (10.0.0.0/16) | Private network |
| Subnet | `jokes-subnet-eastasia` (10.0.1.0/24) | VM subnet |
| NSG | `jokes-nsg-eastasia` | Firewall rules |
| Kong VM | `kong-vm` (10.0.1.10) + Public IP | API Gateway + SSL |
| Joke VM | `joke-vm` (10.0.1.20) + Public IP | Joke + MySQL + ETL |
| RabbitMQ VM | `rabbitmq-vm` (10.0.1.50) + Public IP | Message broker |

### Indonesia Central Resources
| Resource | Name | Purpose |
|----------|------|---------|
| Resource Group | `co3404-jokes-indonesia` | Container for Indonesia Central resources |
| Virtual Network | `jokes-vnet-indonesia` (10.1.0.0/16) | Private network |
| Subnet | `jokes-subnet-indonesia` (10.1.1.0/24) | VM subnet |
| NSG | `jokes-nsg-indonesia` | Firewall rules |
| Submit VM | `submit-vm` (10.1.1.30) + Public IP | Submit service |
| Moderate VM | `moderate-vm` (10.1.1.40) + Public IP | Moderate service |

### Shared Resources
| Resource | Purpose |
|----------|---------|
| SSH Key Pair | Auto-generated 4096-bit RSA (shared across both regions) |

---

## Network Architecture

```
Internet
    |
    v
Kong VM (East Asia - Public IP)  <-- single entry point (HTTPS via Let's Encrypt)
    |
    +-- jokes-vnet-eastasia (10.0.0.0/16)
    |   +-- jokes-subnet-eastasia (10.0.1.0/24)
    |       +-- kong-vm     (10.0.1.10) + Public IP
    |       +-- joke-vm     (10.0.1.20) + Public IP
    |       +-- rabbitmq-vm (10.0.1.50) + Public IP
    |
    +-- jokes-vnet-indonesia (10.1.0.0/16)    [separate region]
        +-- jokes-subnet-indonesia (10.1.1.0/24)
            +-- submit-vm   (10.1.1.30) + Public IP
            +-- moderate-vm (10.1.1.40) + Public IP

Cross-region communication uses PUBLIC IPs
Same-region communication uses PRIVATE IPs
```

---

## Cross-Region Communication

Since VMs are in different Azure regions (different VNets), they **cannot** use private IPs to reach each other. All cross-region traffic goes via public IPs:

| From (Region) | To (Region) | Uses |
|----------------|-------------|------|
| Kong (EA) -> Joke (EA) | Private IP (same VNet) | `10.0.1.20:4000` |
| Kong (EA) -> RabbitMQ (EA) | Private IP (same VNet) | `10.0.1.50:15672` |
| Kong (EA) -> Submit (IDC) | **Public IP** | `<submit-public-ip>:4200` |
| Kong (EA) -> Moderate (IDC) | **Public IP** | `<moderate-public-ip>:4100` |
| Submit (IDC) -> RabbitMQ (EA) | **Public IP** | `<rabbitmq-public-ip>:5672` |
| Moderate (IDC) -> RabbitMQ (EA) | **Public IP** | `<rabbitmq-public-ip>:5672` |
| ETL (EA) -> RabbitMQ (EA) | Private IP (same VNet) | `10.0.1.50:5672` |

Kong uses `--add-host` to map service hostnames to the correct IPs (private for same-VNet, public for cross-region).

---

## Terraform Files

| File | Purpose |
|------|---------|
| `main.tf` | Two resource groups (one per region) |
| `providers.tf` | AzureRM + TLS provider, subscription ID |
| `variables.tf` | Regions, VM size, IP addresses, VM distribution |
| `network.tf` | VNets, subnets, NSGs for both regions |
| `ssh.tf` | SSH key generation (shared key pair) |
| `kong.tf` | Kong VM with public IP (East Asia) |
| `vms.tf` | All service VMs across both regions with public IPs |
| `outputs.tf` | All public IPs, SSH commands, access URLs, region info |
| `cloud-init/docker-install.yaml` | Auto-installs Docker on all VMs |

---

## Step-by-Step: Deploy Infrastructure

### Step 1 - Prerequisites

```bash
# Install Terraform
brew install terraform  # macOS

# Install Azure CLI
brew install azure-cli  # macOS

# Login to Azure
az login

# Set subscription
az account set --subscription "e08005f5-750a-4afc-9b45-14073f57a2f2"
```

### Step 2 - Initialize Terraform

```bash
cd terraform
terraform init
```

### Step 3 - Review Plan

```bash
terraform plan
```

This shows what will be created: 5 VMs across 2 regions, 2 VNets, 2 NSGs, etc.

### Step 4 - Apply

```bash
terraform apply
# Type 'yes' to confirm
```

Takes 3-5 minutes. Creates resources in both regions simultaneously.

### Step 5 - Note the Outputs

```bash
terraform output

# kong_public_ip = "20.xxx.xxx.xxx"
# vm_public_ips = {
#   kong     = "20.xxx.xxx.xxx"
#   joke     = "20.xxx.xxx.xxx"
#   rabbitmq = "20.xxx.xxx.xxx"
#   submit   = "52.xxx.xxx.xxx"
#   moderate = "52.xxx.xxx.xxx"
# }
```

**Important:** Save all public IPs — you need them for GitHub Secrets.

### Step 6 - Wait for Cloud-Init

VMs auto-install Docker via cloud-init. Wait 2-3 minutes.

Verify each VM:
```bash
# SSH directly to any VM (all have public IPs now)
ssh -i ssh_key.pem azureuser@<KONG_IP>
ssh -i ssh_key.pem azureuser@<JOKE_IP>
ssh -i ssh_key.pem azureuser@<RABBITMQ_IP>
ssh -i ssh_key.pem azureuser@<SUBMIT_IP>
ssh -i ssh_key.pem azureuser@<MODERATE_IP>

# Check Docker is installed
docker --version
```

### Step 7 - Destroy When Done

```bash
terraform destroy
# Type 'yes' to confirm
```

**IMPORTANT:** Always destroy VMs when not in use to save Azure credits. This destroys resources in BOTH regions. Alternatively, use `stop.sh` to deallocate VMs without destroying infrastructure.

---

## VM Management Scripts

Instead of `terraform destroy`, you can start/stop VMs to save credits while preserving infrastructure:

```bash
# Start all VMs across both regions
bash start.sh

# Stop (deallocate) all VMs across both regions
bash stop.sh
```

These scripts use `az vm start` / `az vm deallocate` with `--no-wait` for parallel execution.

---

## VM Sizing

| VM | Region | Size | vCPU | RAM |
|----|--------|------|------|-----|
| Kong | East Asia | Standard_B1s | 1 | 1 GB |
| Joke | East Asia | Standard_B1s | 1 | 1 GB |
| RabbitMQ | East Asia | Standard_B1s | 1 | 1 GB |
| Submit | Indonesia Central | Standard_B1s | 1 | 1 GB |
| Moderate | Indonesia Central | Standard_B1s | 1 | 1 GB |

---

## NSG Security Rules (Both Regions)

| Priority | Name | Port | Source | Direction |
|----------|------|------|--------|-----------|
| 1001 | SSH | 22 | Any | Inbound |
| 1002 | HTTP | 80 | Any | Inbound |
| 1003 | HTTPS | 443 | Any | Inbound |
| 1004 | VNet | All | VirtualNetwork | Inbound |
| 1005 | ServicePorts | 3000-5672 | Any | Inbound |
| 1006 | RabbitMQMgmt | 15672 | Any | Inbound |

Additional rules (1005, 1006) allow cross-region service communication via public IPs.

---

## SSL Certificate Provisioning

The CI/CD pipeline provisions a free Let's Encrypt SSL certificate on the Kong VM using Certbot. This is handled automatically during deployment via `setup-ssl.sh`. The certificate is for `g21266967.duckdns.org` and is mounted into the Kong container.

---

## SSH Access

All VMs now have public IPs, so you can SSH directly:

```bash
# Get all SSH commands from Terraform
terraform output ssh_commands

# SSH directly to any VM
ssh -i ssh_key.pem azureuser@<KONG_PUBLIC_IP>
ssh -i ssh_key.pem azureuser@<JOKE_PUBLIC_IP>
ssh -i ssh_key.pem azureuser@<RABBITMQ_PUBLIC_IP>
ssh -i ssh_key.pem azureuser@<SUBMIT_PUBLIC_IP>
ssh -i ssh_key.pem azureuser@<MODERATE_PUBLIC_IP>
```

Kong can still be used as a jump host for same-region VMs if needed:
```bash
# From Kong, SSH to same-region VMs via private IP
ssh azureuser@10.0.1.20  # joke
ssh azureuser@10.0.1.50  # rabbitmq
```
