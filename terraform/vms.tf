# Service VMs Configuration - Multi-Region
# Student ID: G21266967
# East Asia: Joke, RabbitMQ
# Indonesia Central: Submit, Moderate
# All VMs get public IPs for cross-region communication

# ===================================
# EAST ASIA VMs (Joke, RabbitMQ)
# ===================================

# Public IPs for East Asia VMs
resource "azurerm_public_ip" "eastasia_vms" {
  for_each            = local.eastasia_vms
  name                = "${each.key}-pip"
  location            = azurerm_resource_group.eastasia.location
  resource_group_name = azurerm_resource_group.eastasia.name
  allocation_method   = "Static"
  sku                 = "Standard"
}

# Network Interfaces for East Asia VMs
resource "azurerm_network_interface" "eastasia_vms" {
  for_each            = local.eastasia_vms
  name                = "${each.key}-nic"
  location            = azurerm_resource_group.eastasia.location
  resource_group_name = azurerm_resource_group.eastasia.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.eastasia.id
    private_ip_address_allocation = "Static"
    private_ip_address            = each.value.ip
    public_ip_address_id          = azurerm_public_ip.eastasia_vms[each.key].id
  }
}

# Associate NSG with East Asia VMs
resource "azurerm_network_interface_security_group_association" "eastasia_vms" {
  for_each                  = local.eastasia_vms
  network_interface_id      = azurerm_network_interface.eastasia_vms[each.key].id
  network_security_group_id = azurerm_network_security_group.eastasia.id
}

# East Asia Virtual Machines
resource "azurerm_linux_virtual_machine" "eastasia_vms" {
  for_each              = local.eastasia_vms
  name                  = "${each.key}-vm"
  location              = azurerm_resource_group.eastasia.location
  resource_group_name   = azurerm_resource_group.eastasia.name
  size                  = var.vm_size
  admin_username        = var.admin_username
  network_interface_ids = [azurerm_network_interface.eastasia_vms[each.key].id]

  admin_ssh_key {
    username   = var.admin_username
    public_key = tls_private_key.ssh.public_key_openssh
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  custom_data = base64encode(file("${path.module}/cloud-init/docker-install.yaml"))
}

# ===================================
# INDONESIA CENTRAL VMs (Submit, Moderate)
# ===================================

# Public IPs for Indonesia Central VMs
resource "azurerm_public_ip" "indonesia_vms" {
  for_each            = local.indonesia_vms
  name                = "${each.key}-pip"
  location            = azurerm_resource_group.indonesia.location
  resource_group_name = azurerm_resource_group.indonesia.name
  allocation_method   = "Static"
  sku                 = "Standard"
}

# Network Interfaces for Indonesia Central VMs
resource "azurerm_network_interface" "indonesia_vms" {
  for_each            = local.indonesia_vms
  name                = "${each.key}-nic"
  location            = azurerm_resource_group.indonesia.location
  resource_group_name = azurerm_resource_group.indonesia.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.indonesia.id
    private_ip_address_allocation = "Static"
    private_ip_address            = each.value.ip
    public_ip_address_id          = azurerm_public_ip.indonesia_vms[each.key].id
  }
}

# Associate NSG with Indonesia Central VMs
resource "azurerm_network_interface_security_group_association" "indonesia_vms" {
  for_each                  = local.indonesia_vms
  network_interface_id      = azurerm_network_interface.indonesia_vms[each.key].id
  network_security_group_id = azurerm_network_security_group.indonesia.id
}

# Indonesia Central Virtual Machines
resource "azurerm_linux_virtual_machine" "indonesia_vms" {
  for_each              = local.indonesia_vms
  name                  = "${each.key}-vm"
  location              = azurerm_resource_group.indonesia.location
  resource_group_name   = azurerm_resource_group.indonesia.name
  size                  = var.vm_size
  admin_username        = var.admin_username
  network_interface_ids = [azurerm_network_interface.indonesia_vms[each.key].id]

  admin_ssh_key {
    username   = var.admin_username
    public_key = tls_private_key.ssh.public_key_openssh
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  custom_data = base64encode(file("${path.module}/cloud-init/docker-install.yaml"))
}
