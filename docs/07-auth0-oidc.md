# 07 - Auth0 OIDC Authentication

**Requirement:** Very High 1st (79-84%)
**Library:** `express-openid-connect` v2.17.1

---

## What Was Implemented

The Moderate service requires authenticated access for privileged moderation operations. We use OpenID Connect (OIDC) via **Auth0** as the identity provider.

**Protected endpoints (require login):**
- `GET /moderate`
- `POST /moderated`
- `POST /reject`

**Public endpoints (no auth):**
- `GET /types`, `GET /health`, `GET /auth/status`

---

## Auth Flow

```
1. User visits Moderate UI
2. Clicks "Login"
3. Browser redirects to Auth0 login page
4. User enters credentials (email/password or social login)
5. Auth0 validates, issues authorization code
6. Auth0 redirects to /callback?code=...
7. express-openid-connect exchanges code for tokens
8. Session created, user can access protected routes
9. On logout: session destroyed, redirected to Auth0 logout
```

---

## Step-by-Step Setup

### Step 1 - Create Auth0 Account

1. Go to https://auth0.com and sign up (free tier)
2. Choose a tenant name (e.g., `co3404-jokes`)
3. Select your region

### Step 2 - Create Application

1. Auth0 Dashboard > **Applications** > **Applications**
2. Click **+ Create Application**
3. Name: `CO3404 Moderate Service`
4. Type: **Regular Web Applications**
5. Click **Create**

### Step 3 - Configure URLs

In the application settings:

**For local development:**
```
Allowed Callback URLs:    http://localhost:4100/callback
Allowed Logout URLs:      http://localhost:4100
Allowed Web Origins:      http://localhost:4100
```

**For Azure deployment (add as comma-separated):**
```
Allowed Callback URLs:    http://localhost:4100/callback, http://<KONG_IP>/callback
Allowed Logout URLs:      http://localhost:4100, http://<KONG_IP>/moderate-ui
Allowed Web Origins:      http://localhost:4100, http://<KONG_IP>
```

Click **Save Changes**.

### Step 4 - Note Credentials

Copy from the application settings page:
- **Domain** (e.g., `co3404-jokes.eu.auth0.com`)
- **Client ID**
- **Client Secret**

### Step 5 - Create .env File

Create `.env` in the project root:

```bash
OIDC_CLIENT_ID=your-auth0-client-id
OIDC_ISSUER=https://your-tenant.eu.auth0.com
OIDC_SECRET=your-auth0-client-secret
MODERATE_BASE_URL=http://localhost:4100
```

### Step 6 - Start Services

```bash
docker compose --profile mysql up --build
```

The moderate service detects the OIDC variables and enables authentication.

### Step 7 - Test

1. Open http://localhost:4100
2. Click "Login" - redirected to Auth0
3. Log in or create account
4. Redirected back - you can now moderate jokes
5. Click "Logout" to end session
6. Try `GET http://localhost:4100/moderate` without login - returns 401

---

## Code Implementation

### OIDC Configuration (app.js)

```javascript
const oidcEnabled = !!(process.env.OIDC_CLIENT_ID && process.env.OIDC_ISSUER);

const oidcConfig = {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.OIDC_SECRET,
    baseURL: process.env.BASE_URL || 'http://localhost:3100',
    clientID: process.env.OIDC_CLIENT_ID,
    issuerBaseURL: process.env.OIDC_ISSUER,
    routes: {
        login: '/login',
        logout: '/logout',
        callback: '/callback'
    },
    authorizationParams: {
        response_type: 'code',
        scope: 'openid profile email'
    }
};

// Trust proxy when running behind Kong
app.set('trust proxy', true);

if (oidcEnabled) {
    app.use(auth(oidcConfig));
} else {
    // Mock auth for development
    app.use((req, res, next) => {
        req.oidc = {
            isAuthenticated: () => true,
            user: { name: 'Dev Moderator', email: 'moderator@dev.local' }
        };
        next();
    });
}
```

### Protected Routes

```javascript
app.get('/moderate', requiresAuth(), async (req, res) => { ... });
app.post('/moderated', requiresAuth(), async (req, res) => { ... });
app.post('/reject', requiresAuth(), async (req, res) => { ... });
```

### Kong Routes for OIDC

```yaml
- name: moderate-oidc
  paths:
    - /login
    - /logout
    - /callback
  strip_path: false
```

---

## Optional: Restrict by Email

In Auth0 Dashboard > **Actions** > **Triggers** > **post-login**, add:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const allowedEmails = ['your-email@example.com'];
  if (!allowedEmails.includes(event.user.email)) {
    api.access.deny('Access restricted to authorised moderators');
  }
};
```

---

## Docker Compose OIDC Variables

```yaml
moderate:
  environment:
    - OIDC_CLIENT_ID=${OIDC_CLIENT_ID:-}
    - OIDC_ISSUER=${OIDC_ISSUER:-}
    - OIDC_SECRET=${OIDC_SECRET:-}
    - BASE_URL=${MODERATE_BASE_URL:-http://localhost:4100}
```

When empty, OIDC is disabled and mock auth is used.

---

## CI/CD OIDC Secrets

In the GitHub Actions pipeline, OIDC credentials are passed as secrets:

```yaml
- name: Deploy Moderate Service (with OIDC)
  run: |
    docker run -d --name moderate \
      -e OIDC_CLIENT_ID=${{ secrets.OIDC_CLIENT_ID }} \
      -e OIDC_ISSUER=${{ secrets.OIDC_ISSUER }} \
      -e OIDC_SECRET=${{ secrets.OIDC_SECRET }} \
      -e BASE_URL=http://${{ secrets.KONG_PUBLIC_IP }}/moderate-ui \
      moderate-service:latest
```

---

## Video Demo Checklist

1. Show Moderate UI with "Login" button visible
2. Click Login - browser goes to Auth0
3. Enter credentials, log in
4. Show authenticated user name in header
5. Moderate a joke (approve)
6. Logout
7. Show 401 when accessing /moderate without login
8. Show console: "OIDC authentication ENABLED via Auth0"
