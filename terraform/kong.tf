# Kong Gateway VM Configuration - East Asia
# Student ID: G21266967

# Public IP for Kong (main entry point)
resource "azurerm_public_ip" "kong" {
  name                = "kong-pip"
  location            = azurerm_resource_group.eastasia.location
  resource_group_name = azurerm_resource_group.eastasia.name
  allocation_method   = "Static"
  sku                 = "Standard"
}

# Network Interface for Kong
resource "azurerm_network_interface" "kong" {
  name                = "kong-nic"
  location            = azurerm_resource_group.eastasia.location
  resource_group_name = azurerm_resource_group.eastasia.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.eastasia.id
    private_ip_address_allocation = "Static"
    private_ip_address            = local.kong_private_ip
    public_ip_address_id          = azurerm_public_ip.kong.id
  }
}

# Associate NSG with Kong NIC
resource "azurerm_network_interface_security_group_association" "kong" {
  network_interface_id      = azurerm_network_interface.kong.id
  network_security_group_id = azurerm_network_security_group.eastasia.id
}

# Kong Virtual Machine
resource "azurerm_linux_virtual_machine" "kong" {
  name                  = "kong-vm"
  location              = azurerm_resource_group.eastasia.location
  resource_group_name   = azurerm_resource_group.eastasia.name
  size                  = var.vm_size
  admin_username        = var.admin_username
  network_interface_ids = [azurerm_network_interface.kong.id]

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
