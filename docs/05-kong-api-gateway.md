# 05 - Kong API Gateway

**Image:** `kong:3.4-alpine`
**Ports:** 80 (HTTP), 443 (HTTPS with Let's Encrypt)
**Location:** `services/kong/`
**Config mode:** Declarative (DB-less, via `kong.yaml`)
**Public URL:** `https://g21266967.duckdns.org`

---

## What It Does

Kong acts as the single entry point for all microservices. External clients connect to Kong via the DuckDNS domain over HTTPS. Kong routes requests to the correct backend service using path-based routing and applies security plugins (rate limiting, CORS, request size limits, security headers).

```
Internet --> Kong (https://g21266967.duckdns.org, ports 80/443)
                |
                +--> /joke, /types       --> Joke Service (10.0.1.20:4000)
                +--> /joke-ui            --> Joke Service (static files)
                +--> /submit, /docs      --> Submit Service (submit-public-ip:4200)
                +--> /submit-ui          --> Submit Service (static files)
                +--> /moderate, etc.     --> Moderate Service (moderate-public-ip:4100)
                +--> /history            --> Moderate Service (moderation history)
                +--> /login, /callback   --> Moderate Service (OIDC routes)
                +--> /moderate-ui        --> Moderate Service (static files)
                +--> /rmq               --> RabbitMQ Management (10.0.1.50:15672)
                +--> /js, /css, /img, /api --> RabbitMQ Assets (proxied)
```

---

## Configuration File (kong.yaml)

```yaml
_format_version: "3.0"
_transform: true

services:
  - name: joke-service
    url: http://joke:4000
    routes:
      - name: joke-api
        paths: [/joke, /types]
        strip_path: false
      - name: joke-ui
        paths: [/joke-ui]
        strip_path: true

  - name: submit-service
    url: http://submit:4200
    routes:
      - name: submit-api
        paths: [/submit, /docs]
        strip_path: false
      - name: submit-ui
        paths: [/submit-ui]
        strip_path: true

  - name: moderate-service
    url: http://moderate:4100
    routes:
      - name: moderate-api
        paths: [/moderate, /moderated, /reject, /auth, /history]
        strip_path: false
      - name: moderate-oidc
        paths: [/login, /logout, /callback]
        strip_path: false
      - name: moderate-ui
        paths: [/moderate-ui]
        strip_path: true

  - name: rabbitmq-admin
    url: http://rabbitmq:15672
    routes:
      - name: rmq
        paths: [/rmq]
        strip_path: false

  - name: rabbitmq-assets
    url: http://rabbitmq:15672/rmq
    routes:
      - name: rmq-assets
        paths: [/js, /css, /img, /favicon.ico, /api]
        strip_path: false
```

### Route Explanation

- **`strip_path: false`** - The path is kept when forwarding (e.g., `/joke/dad` -> `http://joke:4000/joke/dad`)
- **`strip_path: true`** - The path prefix is removed (e.g., `/joke-ui/index.html` -> `http://joke:4000/index.html`)
- **OIDC routes** (`/login`, `/logout`, `/callback`) are forwarded to the Moderate service for Auth0 flow
- **RabbitMQ assets** (`/js`, `/css`, `/img`, `/api`) are proxied so the RabbitMQ management UI loads correctly through Kong

---

## Plugins

### Rate Limiting (Per Service)

```yaml
plugins:
  - name: rate-limiting
    service: joke-service
    config:
      minute: 60
      policy: local

  - name: rate-limiting
    service: submit-service
    config:
      minute: 60
      policy: local

  - name: rate-limiting
    service: moderate-service
    config:
      minute: 100
      policy: local

  - name: rate-limiting
    service: rabbitmq-admin
    config:
      minute: 50
      policy: local

  - name: rate-limiting
    service: rabbitmq-assets
    config:
      minute: 100
      policy: local
```

Each service has its own rate limit. When exceeded, Kong returns `429 Too Many Requests`.

### CORS (Global - Restricted)

```yaml
  - name: cors
    config:
      origins:
        - "https://g21266967.duckdns.org"
        - "http://g21266967.duckdns.org"
        - "http://20.239.48.46"
        - "https://20.239.48.46"
      methods: [GET, POST, PUT, DELETE, OPTIONS]
      headers: [Content-Type, Authorization]
      credentials: true
      max_age: 3600
```

CORS is restricted to the Kong domain and IP only (not wildcard `*`). This prevents unauthorized cross-origin requests.

### Request Size Limiting (Global)

```yaml
  - name: request-size-limiting
    config:
      allowed_payload_size: 1
      size_unit: megabytes
```

Prevents large payload attacks by limiting request bodies to 1 MB.

### Security Response Headers (Global)

```yaml
  - name: response-transformer
    config:
      add:
        headers:
          - "X-Frame-Options:DENY"
          - "X-Content-Type-Options:nosniff"
          - "X-XSS-Protection:1; mode=block"
          - "Referrer-Policy:strict-origin-when-cross-origin"
```

Adds security headers to all responses to prevent clickjacking, MIME sniffing, and XSS attacks.

---

## HTTPS with Let's Encrypt

Kong serves HTTPS using a free TLS certificate from Let's Encrypt, provisioned via Certbot during CI/CD deployment. The certificate is for `g21266967.duckdns.org`.

The CI/CD pipeline runs `setup-ssl.sh` on the Kong VM to obtain/renew the certificate, then mounts it into the Kong container:

```bash
docker run -d --name kong \
  -p 80:8000 -p 443:8443 \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  -e KONG_SSL_CERT=/etc/letsencrypt/live/g21266967.duckdns.org/fullchain.pem \
  -e KONG_SSL_CERT_KEY=/etc/letsencrypt/live/g21266967.duckdns.org/privkey.pem \
  kong-gateway:latest
```

---

## Dockerfile

```dockerfile
FROM kong:3.4-alpine
COPY kong.yaml /usr/local/kong/declarative/kong.yaml
ENV KONG_DATABASE=off
ENV KONG_DECLARATIVE_CONFIG=/usr/local/kong/declarative/kong.yaml
EXPOSE 8000 8443 8001
CMD ["kong", "docker-start"]
```

---

## Key Files

| File | Purpose |
|------|---------|
| `kong.yaml` | Declarative routing, services, and plugins configuration |
| `Dockerfile` | Copies kong.yaml into the Kong image |
| `setup-ssl.sh` | Certbot script for Let's Encrypt SSL certificate |

---

## Rate Limiting Demo (for Video)

```bash
# Run 65 requests rapidly
for i in $(seq 1 65); do
  echo "Request $i: $(curl -s -o /dev/null -w '%{http_code}' https://g21266967.duckdns.org/joke/general)"
done
```

After 60 requests, you should see `429` status codes (rate limited).

---

## How Kong Resolves Services in Docker vs Azure

**Locally (Docker Compose):** Kong resolves service names (`joke`, `submit`, `moderate`, `rabbitmq`) via Docker's internal DNS on the `joke-network`.

**On Azure:** Kong runs on its own VM. Service names are resolved via `--add-host` flags passed during `docker run`. Same-region VMs use private IPs, cross-region VMs use public IPs:

```bash
docker run -d --name kong \
  -p 80:8000 -p 443:8443 \
  --add-host=joke:10.0.1.20 \
  --add-host=rabbitmq:10.0.1.50 \
  --add-host=submit:<SUBMIT_PUBLIC_IP> \
  --add-host=moderate:<MODERATE_PUBLIC_IP> \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  kong-gateway:latest
```
