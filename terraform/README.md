# Terraform Infrastructure

**Student ID: G21266967**

This directory contains the Terraform configuration for deploying the distributed jokes system to Azure.

## File Structure

```
terraform/
├── main.tf           # Resource group (main entry point)
├── providers.tf      # Terraform and provider configuration
├── variables.tf      # Input variables and VM configuration
├── outputs.tf        # Output values (IPs, URLs, SSH command)
├── network.tf        # Virtual network, subnet, and security group
├── ssh.tf            # SSH key generation
├── kong.tf           # Kong gateway VM with public IP
├── vms.tf            # Service VMs (joke, submit, moderate, rabbitmq)
└── cloud-init/
    └── docker-install.yaml  # Docker installation script
```

## Resources Created

### Network Infrastructure
- **Resource Group**: `co3404-jokes` in East Asia
- **Virtual Network**: `jokes-vnet` (10.0.0.0/16)
- **Subnet**: `jokes-subnet` (10.0.1.0/24)
- **Network Security Group**: Allows SSH (22), HTTP (80), HTTPS (443), and VNet traffic

### Virtual Machines
- **Kong VM** (Standard_B1s): Gateway with public IP - 10.0.1.10
- **Joke VM** (Standard_B2s): Joke service - 10.0.1.20
- **Submit VM** (Standard_B1s): Submit service - 10.0.1.30
- **Moderate VM** (Standard_B1s): Moderate service - 10.0.1.40
- **RabbitMQ VM** (Standard_B1s): Message queue - 10.0.1.50

All VMs run Ubuntu 22.04 LTS with Docker pre-installed via cloud-init.

## Usage

### Initialize (first time only)
```bash
terraform init
```

### Preview Changes
```bash
terraform plan
```

### Deploy Infrastructure
```bash
terraform apply
```

### View Outputs
```bash
terraform output
```

### Destroy Everything
```bash
terraform destroy
```

## Customization

Edit `variables.tf` to customize:
- **location**: Azure region (default: eastasia)
- **resource_group_name**: Name of resource group (default: co3404-jokes)
- **VM sizes**: Change VM sizes in the `locals.vms` block
- **IP addresses**: Modify VM IP addresses

## Estimated Costs

- Kong VM (Standard_B1s): ~$9/month
- Joke VM (Standard_B2s): ~$36/month
- Submit VM (Standard_B1s): ~$9/month
- Moderate VM (Standard_B1s): ~$9/month
- RabbitMQ VM (Standard_B1s): ~$9/month

**Total: ~$72/month** (plus storage and bandwidth)

## SSH Access

After deployment, connect to Kong VM:
```bash
ssh -i ssh_key.pem azureuser@<PUBLIC_IP>
```

The SSH key is automatically generated and saved to `ssh_key.pem`.

## Next Steps

After infrastructure is deployed:
1. Wait 3-5 minutes for VMs to initialize
2. Run the deployment script: `cd ../scripts && ./deploy.sh`
3. Access services via the public IP shown in outputs
