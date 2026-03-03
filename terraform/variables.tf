# Terraform Variables
# Student ID: G21266967
# Multi-Region Deployment: East Asia + Indonesia Central

variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
  default     = "e08005f5-750a-4afc-9b45-14073f57a2f2"
}

variable "admin_username" {
  description = "Admin username for VMs"
  type        = string
  default     = "azureuser"
}

# ===========================
# Region Configuration
# ===========================

variable "region_primary" {
  description = "Primary Azure region"
  type        = string
  default     = "eastasia"
}

variable "region_secondary" {
  description = "Secondary Azure region"
  type        = string
  default     = "indonesiacentral"
}

variable "vm_size" {
  description = "VM size for all VMs"
  type        = string
  default     = "Standard_B2ats_v2"
}

# ===========================
# VM Distribution Across Regions
# ===========================
# East Asia:           Kong, Joke (+MySQL+ETL), RabbitMQ  (core data path)
# Indonesia Central:   Submit, Moderate                   (UI services)

locals {
  # East Asia VMs (excluding Kong which is defined separately)
  eastasia_vms = {
    joke = {
      ip = "10.0.1.20"
    }
    rabbitmq = {
      ip = "10.0.1.50"
    }
  }

  # Indonesia Central VMs
  indonesia_vms = {
    submit = {
      ip = "10.1.1.30"
    }
    moderate = {
      ip = "10.1.1.40"
    }
  }

  # Kong private IP (East Asia)
  kong_private_ip = "10.0.1.10"
}
