# SSH Key Generation
# Student ID: G21266967

# Generate SSH key pair
resource "tls_private_key" "ssh" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

# Save private key locally
resource "local_file" "ssh_key" {
  content         = tls_private_key.ssh.private_key_pem
  filename        = "${path.module}/ssh_key.pem"
  file_permission = "0600"
}
