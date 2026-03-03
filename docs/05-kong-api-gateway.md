# 05 - Kong API Gateway

**Image:** `kong:3.4-alpine`
**Ports:** 80 (HTTP proxy), 443 (HTTPS proxy)
**Location:** `services/kong/`
**Config mode:** Declarative (DB-less, via `kong.yaml`)

---

## What It Does

Kong acts as the single entry point for all microservices. External clients only connect to Kong's public IP. Kong routes requests to the correct backend service using path-based routing.

```
Internet --> Kong (Public IP, port 80/443)
                |
                +--> /joke, /types       --> Joke Service (10.0.1.20:3000)
                +--> /joke-ui            --> Joke Service (static files)
                +--> /submit, /docs      --> Submit Service (10.0.1.30:3200)
                +--> /submit-ui          --> Submit Service (static files)
                +--> /moderate, etc.     --> Moderate Service (10.0.1.40:3100)
                +--> /login, /callback   --> Moderate Service (OIDC routes)
                +--> /moderate-ui        --> Moderate Service (static files)
                +--> /rmq               --> RabbitMQ Management (10.0.1.50:15672)
```

---

## Configuration File (kong.yaml)

```yaml
_format_version: "3.0"
_transform: true

services:
  - name: joke-service
    url: http://joke:3000
    routes:
      - name: joke-api
        paths: [/joke, /types]
        strip_path: false
      - name: joke-ui
        paths: [/joke-ui]
        strip_path: true

  - name: submit-service
    url: http://submit:3200
    routes:
      - name: submit-api
        paths: [/submit, /docs]
        strip_path: false
      - name: submit-ui
        paths: [/submit-ui]
        strip_path: true

  - name: moderate-service
    url: http://moderate:3100
    routes:
      - name: moderate-api
        paths: [/moderate, /moderated, /reject, /auth]
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
        strip_path: true
```

### Route Explanation

- **`strip_path: false`** - The path is kept when forwarding (e.g., `/joke/dad` -> `http://joke:3000/joke/dad`)
- **`strip_path: true`** - The path prefix is removed (e.g., `/joke-ui/index.html` -> `http://joke:3000/index.html`)
- **OIDC routes** (`/login`, `/logout`, `/callback`) are forwarded to the Moderate service for Auth0 flow

---

## Plugins

### Rate Limiting (Joke Service)

```yaml
plugins:
  - name: rate-limiting
    service: joke-service
    config:
      minute: 20
      policy: local
```

Limits the Joke service API to 20 requests per minute per client. When exceeded, Kong returns `429 Too Many Requests`.

### CORS (Global)

```yaml
  - name: cors
    config:
      origins: ["*"]
      methods: [GET, POST, PUT, DELETE, OPTIONS]
      headers: [Content-Type, Authorization]
      credentials: true
```

Allows cross-origin requests from any domain.

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

---

## Rate Limiting Demo (for Video)

```bash
# Run 25 requests rapidly
for i in $(seq 1 25); do
  echo "Request $i: $(curl -s -o /dev/null -w '%{http_code}' http://localhost/joke/general)"
done
```

After 20 requests, you should see `429` status codes (rate limited).

---

## How Kong Resolves Services in Docker vs Azure

**Locally (Docker Compose):** Kong resolves service names (`joke`, `submit`, `moderate`, `rabbitmq`) via Docker's internal DNS on the `joke-network`.

**On Azure:** Kong runs on its own VM. Service names are resolved via `--add-host` flags passed during `docker run`:

```bash
docker run -d --name kong \
  --add-host=joke:10.0.1.20 \
  --add-host=submit:10.0.1.30 \
  --add-host=moderate:10.0.1.40 \
  --add-host=rabbitmq:10.0.1.50 \
  kong-gateway:latest
```
