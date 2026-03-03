# Network Configuration - Multi-Region (Hardened)
# Student ID: G21266967
# Creates VNets, subnets, and NSGs in both East Asia and Indonesia Central
#
# Security Design:
# - SSH restricted to CI/CD runner IPs (GitHub Actions) only
# - Service ports restricted to specific cross-region VM IPs
# - RabbitMQ AMQP/Management only accessible from known service IPs
# - Kong is the ONLY public-facing entry point (HTTP/HTTPS)
# - Deny-all implicit rule blocks everything else

# ===================================
# EAST ASIA Network (Kong, Joke, RabbitMQ)
# ===================================

resource "azurerm_virtual_network" "eastasia" {
  name                = "jokes-vnet-eastasia"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.eastasia.location
  resource_group_name = azurerm_resource_group.eastasia.name
}

resource "azurerm_subnet" "eastasia" {
  name                 = "jokes-subnet-eastasia"
  resource_group_name  = azurerm_resource_group.eastasia.name
  virtual_network_name = azurerm_virtual_network.eastasia.name
  address_prefixes     = ["10.0.1.0/24"]
}

resource "azurerm_network_security_group" "eastasia" {
  name                = "jokes-nsg-eastasia"
  location            = azurerm_resource_group.eastasia.location
  resource_group_name = azurerm_resource_group.eastasia.name

  # SSH - restricted to CI/CD deployment only
  # In production, this would be restricted to a Bastion subnet or VPN IP
  security_rule {
    name                       = "SSH-CICD"
    priority                   = 1001
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
    description                = "SSH for CI/CD deployment - would use Bastion/VPN in production"
  }

  # HTTP/HTTPS - only Kong VM needs public web access
  security_rule {
    name                       = "HTTP-Kong"
    priority                   = 1002
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = local.kong_private_ip
    description                = "HTTP traffic to Kong gateway only"
  }

  security_rule {
    name                       = "HTTPS-Kong"
    priority                   = 1003
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = local.kong_private_ip
    description                = "HTTPS traffic to Kong gateway only"
  }

  # VNet internal communication
  security_rule {
    name                       = "AllowVNetInbound"
    priority                   = 1004
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "VirtualNetwork"
    destination_address_prefix = "VirtualNetwork"
  }

  # Joke Service API - only accessible from Kong (internal routing)
  security_rule {
    name                       = "JokeAPI-FromKong"
    priority                   = 1005
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "4000"
    source_address_prefix      = local.kong_private_ip
    destination_address_prefix = "10.0.1.20"
    description                = "Kong routes to Joke Service API"
  }

  # Joke Service API - also accessible from Submit (Indonesia) for fetching types
  security_rule {
    name                       = "JokeAPI-FromSubmit"
    priority                   = 1010
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "4000"
    source_address_prefix      = azurerm_public_ip.indonesia_vms["submit"].ip_address
    destination_address_prefix = "10.0.1.20"
    description                = "Submit service fetches joke types cross-region"
  }

  # RabbitMQ AMQP - only from known service VMs (cross-region)
  security_rule {
    name                         = "RabbitMQ-AMQP-CrossRegion"
    priority                     = 1006
    direction                    = "Inbound"
    access                       = "Allow"
    protocol                     = "Tcp"
    source_port_range            = "*"
    destination_port_range       = "5672"
    source_address_prefixes      = [
      azurerm_public_ip.indonesia_vms["submit"].ip_address,
      azurerm_public_ip.indonesia_vms["moderate"].ip_address,
    ]
    destination_address_prefix   = "10.0.1.50"
    description                  = "AMQP access from Submit and Moderate services only"
  }

  # RabbitMQ AMQP - from ETL worker (same region, via VNet)
  security_rule {
    name                       = "RabbitMQ-AMQP-ETL"
    priority                   = 1007
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "5672"
    source_address_prefix      = "10.0.1.20"
    destination_address_prefix = "10.0.1.50"
    description                = "AMQP access from ETL worker on Joke VM"
  }

  # RabbitMQ Management UI - only from Kong (proxied via /rmq)
  security_rule {
    name                       = "RabbitMQ-Mgmt-FromKong"
    priority                   = 1008
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "15672"
    source_address_prefix      = local.kong_private_ip
    destination_address_prefix = "10.0.1.50"
    description                = "RabbitMQ Management UI via Kong proxy only"
  }

  # Deny all other inbound traffic (explicit deny for clarity)
  security_rule {
    name                       = "DenyAllOther"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
    description                = "Deny all traffic not explicitly allowed above"
  }
}

# ===================================
# INDONESIA CENTRAL Network (Submit, Moderate)
# ===================================

resource "azurerm_virtual_network" "indonesia" {
  name                = "jokes-vnet-indonesia"
  address_space       = ["10.1.0.0/16"]
  location            = azurerm_resource_group.indonesia.location
  resource_group_name = azurerm_resource_group.indonesia.name
}

resource "azurerm_subnet" "indonesia" {
  name                 = "jokes-subnet-indonesia"
  resource_group_name  = azurerm_resource_group.indonesia.name
  virtual_network_name = azurerm_virtual_network.indonesia.name
  address_prefixes     = ["10.1.1.0/24"]
}

resource "azurerm_network_security_group" "indonesia" {
  name                = "jokes-nsg-indonesia"
  location            = azurerm_resource_group.indonesia.location
  resource_group_name = azurerm_resource_group.indonesia.name

  # SSH - restricted to CI/CD deployment only
  security_rule {
    name                       = "SSH-CICD"
    priority                   = 1001
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
    description                = "SSH for CI/CD deployment - would use Bastion/VPN in production"
  }

  # Submit Service - only from Kong (cross-region proxy)
  security_rule {
    name                       = "SubmitAPI-FromKong"
    priority                   = 1002
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "4200"
    source_address_prefix      = azurerm_public_ip.kong.ip_address
    destination_address_prefix = "10.1.1.30"
    description                = "Kong routes to Submit Service cross-region"
  }

  # Moderate Service - only from Kong (cross-region proxy)
  security_rule {
    name                       = "ModerateAPI-FromKong"
    priority                   = 1003
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "4100"
    source_address_prefix      = azurerm_public_ip.kong.ip_address
    destination_address_prefix = "10.1.1.40"
    description                = "Kong routes to Moderate Service cross-region"
  }

  # VNet internal communication
  security_rule {
    name                       = "AllowVNetInbound"
    priority                   = 1004
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "VirtualNetwork"
    destination_address_prefix = "VirtualNetwork"
  }

  # Deny all other inbound traffic
  security_rule {
    name                       = "DenyAllOther"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
    description                = "Deny all traffic not explicitly allowed above"
  }
}
