# Terraform Outputs - Multi-Region
# Student ID: G21266967

# ===========================
# Kong (Main Entry Point)
# ===========================

output "kong_public_ip" {
  description = "Public IP address of Kong gateway"
  value       = azurerm_public_ip.kong.ip_address
}

output "ssh_command" {
  description = "SSH command to connect to Kong VM"
  value       = "ssh -i ssh_key.pem ${var.admin_username}@${azurerm_public_ip.kong.ip_address}"
}

# ===========================
# All VM Public IPs
# ===========================

output "vm_public_ips" {
  description = "Public IP addresses of all VMs (needed for cross-region communication)"
  value = {
    kong     = azurerm_public_ip.kong.ip_address
    joke     = azurerm_public_ip.eastasia_vms["joke"].ip_address
    rabbitmq = azurerm_public_ip.eastasia_vms["rabbitmq"].ip_address
    submit   = azurerm_public_ip.indonesia_vms["submit"].ip_address
    moderate = azurerm_public_ip.indonesia_vms["moderate"].ip_address
  }
}

# ===========================
# Private IPs (for same-region communication)
# ===========================

output "private_ips" {
  description = "Private IP addresses of all VMs"
  value = {
    kong     = local.kong_private_ip
    joke     = local.eastasia_vms.joke.ip
    rabbitmq = local.eastasia_vms.rabbitmq.ip
    submit   = local.indonesia_vms.submit.ip
    moderate = local.indonesia_vms.moderate.ip
  }
}

# ===========================
# Region Information
# ===========================

output "region_distribution" {
  description = "Which VMs are in which region"
  value = {
    eastasia = {
      region = var.region_primary
      vms    = ["kong-vm", "joke-vm", "rabbitmq-vm"]
    }
    indonesia = {
      region = var.region_secondary
      vms    = ["submit-vm", "moderate-vm"]
    }
  }
}

# ===========================
# Access URLs
# ===========================

output "access_urls" {
  description = "Public URLs to access services via Kong"
  value = {
    joke_ui     = "http://${azurerm_public_ip.kong.ip_address}/joke-ui"
    submit_ui   = "http://${azurerm_public_ip.kong.ip_address}/submit-ui"
    moderate_ui = "http://${azurerm_public_ip.kong.ip_address}/moderate-ui"
    api_docs    = "http://${azurerm_public_ip.kong.ip_address}/docs"
    rabbitmq    = "http://${azurerm_public_ip.kong.ip_address}/rmq"
  }
}

# ===========================
# Resource Groups
# ===========================

output "resource_groups" {
  description = "Resource group details"
  value = {
    eastasia = {
      name     = azurerm_resource_group.eastasia.name
      location = azurerm_resource_group.eastasia.location
    }
    indonesia = {
      name     = azurerm_resource_group.indonesia.name
      location = azurerm_resource_group.indonesia.location
    }
  }
}

# ===========================
# SSH Commands for All VMs
# ===========================

output "ssh_commands" {
  description = "SSH commands for all VMs (all have public IPs)"
  value = {
    kong     = "ssh -i ssh_key.pem ${var.admin_username}@${azurerm_public_ip.kong.ip_address}"
    joke     = "ssh -i ssh_key.pem ${var.admin_username}@${azurerm_public_ip.eastasia_vms["joke"].ip_address}"
    rabbitmq = "ssh -i ssh_key.pem ${var.admin_username}@${azurerm_public_ip.eastasia_vms["rabbitmq"].ip_address}"
    submit   = "ssh -i ssh_key.pem ${var.admin_username}@${azurerm_public_ip.indonesia_vms["submit"].ip_address}"
    moderate = "ssh -i ssh_key.pem ${var.admin_username}@${azurerm_public_ip.indonesia_vms["moderate"].ip_address}"
  }
}
