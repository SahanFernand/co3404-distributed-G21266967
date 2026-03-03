#!/bin/bash
# SSL Certificate Setup - Let's Encrypt via Certbot
# Student ID: G21266967
# Domain: g21266967.duckdns.org
#
# This script obtains a free TLS certificate from Let's Encrypt
# using standalone HTTP challenge on port 80.
# Kong must be stopped before running this (port 80 must be free).

DOMAIN="g21266967.duckdns.org"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    sudo apt-get update -y
    sudo apt-get install -y certbot
fi

# Stop Kong temporarily to free port 80 for certbot challenge
docker rm -f kong 2>/dev/null || true

# Obtain certificate (standalone mode uses port 80)
sudo certbot certonly --standalone \
    -d "${DOMAIN}" \
    --non-interactive \
    --agree-tos \
    --email g21266967@live.mdx.ac.uk \
    --no-eff-email

# Verify certificate was obtained
if [ -f "${CERT_DIR}/fullchain.pem" ] && [ -f "${CERT_DIR}/privkey.pem" ]; then
    echo "SSL certificate obtained successfully for ${DOMAIN}"
    echo "  Certificate: ${CERT_DIR}/fullchain.pem"
    echo "  Private Key: ${CERT_DIR}/privkey.pem"
else
    echo "ERROR: Failed to obtain SSL certificate"
    exit 1
fi
