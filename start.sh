#!/bin/bash
# Start all Azure VMs for CO3404 Distributed Systems
# Student ID: G21266967

echo "Starting all VMs..."

# East Asia: Kong, Joke, RabbitMQ
az vm start --resource-group co3404-jokes-eastasia --name kong-vm --no-wait
echo "  Kong VM starting..."

az vm start --resource-group co3404-jokes-eastasia --name joke-vm --no-wait
echo "  Joke VM starting..."

az vm start --resource-group co3404-jokes-eastasia --name rabbitmq-vm --no-wait
echo "  RabbitMQ VM starting..."

# Indonesia Central: Submit, Moderate
az vm start --resource-group co3404-jokes-indonesia --name submit-vm --no-wait
echo "  Submit VM starting..."

az vm start --resource-group co3404-jokes-indonesia --name moderate-vm --no-wait
echo "  Moderate VM starting..."

echo ""
echo "All VMs are starting (--no-wait). Takes ~1-2 mins to fully boot."
echo "Check status: az vm list -d --output table --query \"[].{Name:name, Status:powerState}\""
