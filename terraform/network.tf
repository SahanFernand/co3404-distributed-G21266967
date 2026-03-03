# Network Configuration - Multi-Region
# Student ID: G21266967
# Creates VNets, subnets, and NSGs in both East Asia and Indonesia Central

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

  security_rule {
    name                       = "SSH"
    priority                   = 1001
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "HTTP"
    priority                   = 1002
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "HTTPS"
    priority                   = 1003
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

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

  # Allow cross-region service communication (AMQP, HTTP)
  security_rule {
    name                       = "AllowServicePorts"
    priority                   = 1005
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "3000-5672"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  # Allow RabbitMQ Management UI
  security_rule {
    name                       = "AllowRabbitMQMgmt"
    priority                   = 1006
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "15672"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
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

  security_rule {
    name                       = "SSH"
    priority                   = 1001
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "HTTP"
    priority                   = 1002
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "HTTPS"
    priority                   = 1003
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

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

  # Allow cross-region service communication (AMQP, HTTP)
  security_rule {
    name                       = "AllowServicePorts"
    priority                   = 1005
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "3000-5672"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  # Allow RabbitMQ Management UI
  security_rule {
    name                       = "AllowRabbitMQMgmt"
    priority                   = 1006
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "15672"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}
