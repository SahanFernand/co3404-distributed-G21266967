#!/bin/bash
# Stop and deallocate all Azure VMs for CO3404 Distributed Systems
# Student ID: G21266967
# Deallocate = no charges for compute

echo "Stopping and deallocating all VMs..."

# East Asia: Kong, Joke, RabbitMQ
az vm deallocate --resource-group co3404-jokes-eastasia --name kong-vm --no-wait
echo "  Kong VM stopping..."

az vm deallocate --resource-group co3404-jokes-eastasia --name joke-vm --no-wait
echo "  Joke VM stopping..."

az vm deallocate --resource-group co3404-jokes-eastasia --name rabbitmq-vm --no-wait
echo "  RabbitMQ VM stopping..."

# Indonesia Central: Submit, Moderate
az vm deallocate --resource-group co3404-jokes-indonesia --name submit-vm --no-wait
echo "  Submit VM stopping..."

az vm deallocate --resource-group co3404-jokes-indonesia --name moderate-vm --no-wait
echo "  Moderate VM stopping..."

echo ""
echo "All VMs are deallocating (--no-wait). No compute charges while stopped."
echo "Check status: az vm list -d --output table --query \"[].{Name:name, Status:powerState}\""
