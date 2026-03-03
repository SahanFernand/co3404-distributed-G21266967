# Main Terraform Configuration
# CO3404 Distributed Systems - Option 4
# Student ID: G21266967
# Multi-Region: East Asia + Indonesia Central

# This is the main entry point for the Terraform configuration.
# Resources are organized across multiple files:
#
# - providers.tf: Terraform and provider configuration
# - variables.tf: Input variables and local values
# - outputs.tf: Output values
# - network.tf: Virtual networks, subnets, and security groups (both regions)
# - ssh.tf: SSH key generation
# - kong.tf: Kong gateway VM with public IP (East Asia)
# - vms.tf: Service VMs across both regions

# =================================
# Resource Groups (one per region)
# =================================

resource "azurerm_resource_group" "eastasia" {
  name     = "co3404-jokes-eastasia"
  location = var.region_primary
}

resource "azurerm_resource_group" "indonesia" {
  name     = "co3404-jokes-indonesia"
  location = var.region_secondary
}
