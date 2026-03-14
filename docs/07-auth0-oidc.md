# 07 - Auth0 OIDC Authentication + RBAC

**Requirement:** Very High 1st (79-84%)
**Library:** `express-openid-connect` v2.17.1

---

## What Was Implemented

The Moderate service requires authenticated access for privileged moderation operations. We use OpenID Connect (OIDC) via **Auth0** as the identity provider, with server-side RBAC (Role-Based Access Control) to restrict moderation to specific email addresses.

**Protected endpoints (require login + RBAC):**
- `GET /moderate`
- `POST /moderated`
- `POST /reject`
- `GET /history`

**Public endpoints (no auth):**
- `GET /types`, `GET /health`, `GET /auth/status`

---

## Auth Flow

```
1. User visits Moderate UI
2. Clicks "Login"
3. Browser redirects to Auth0 login page
4. User enters credentials (email/password or Google social login)
5. Auth0 validates, issues authorization code
6. Auth0 redirects to /callback?code=...
7. express-openid-connect exchanges code for tokens
8. Session created, RBAC check: is email in ALLOWED_MODERATORS?
9. If allowed: user can access protected routes
10. If not allowed: returns 403 Forbidden
11. On logout: session destroyed, redirected to Auth0 logout
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
Allowed Callback URLs:    http://localhost:4100/callback, https://g21266967.duckdns.org/callback
Allowed Logout URLs:      http://localhost:4100, https://g21266967.duckdns.org/moderate-ui
Allowed Web Origins:      http://localhost:4100, https://g21266967.duckdns.org
```

Click **Save Changes**.

### Step 4 - Note Credentials

Copy from the application settings page:
- **Domain** (e.g., `your-tenant.us.auth0.com`)
- **Client ID**
- **Client Secret**

These are stored as GitHub Secrets for CI/CD deployment (never committed to code).

### Step 5 - Create .env File

Create `.env` in the project root:

```bash
OIDC_CLIENT_ID=your-auth0-client-id
OIDC_ISSUER=https://your-tenant.us.auth0.com
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

### RBAC Middleware (app.js)

```javascript
const allowedModerators = (process.env.ALLOWED_MODERATORS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

function requiresModerator(req, res, next) {
    if (allowedModerators.length === 0) return next(); // No restriction if empty
    const userEmail = req.oidc?.user?.email?.toLowerCase();
    if (!allowedModerators.includes(userEmail)) {
        return res.status(403).json({ error: 'Access denied. Not an authorised moderator.' });
    }
    next();
}
```

### Protected Routes

```javascript
app.get('/moderate', requiresAuth(), requiresModerator, async (req, res) => { ... });
app.post('/moderated', requiresAuth(), requiresModerator, async (req, res) => { ... });
app.post('/reject', requiresAuth(), requiresModerator, async (req, res) => { ... });
app.get('/history', requiresAuth(), requiresModerator, async (req, res) => { ... });
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

## Docker Compose OIDC Variables

```yaml
moderate:
  environment:
    - OIDC_CLIENT_ID=${OIDC_CLIENT_ID:-}
    - OIDC_ISSUER=${OIDC_ISSUER:-}
    - OIDC_SECRET=${OIDC_SECRET:-}
    - BASE_URL=${MODERATE_BASE_URL:-http://localhost:4100}
    - ALLOWED_MODERATORS=${ALLOWED_MODERATORS:-}
```

When empty, OIDC is disabled and mock auth is used.

---

## CI/CD OIDC + RBAC Secrets

In the GitHub Actions pipeline, OIDC credentials and RBAC config are passed as secrets:

```yaml
- name: Deploy Moderate Service (with OIDC + RBAC)
  run: |
    docker run -d --name moderate \
      -e OIDC_CLIENT_ID=${{ secrets.OIDC_CLIENT_ID }} \
      -e OIDC_ISSUER=${{ secrets.OIDC_ISSUER }} \
      -e OIDC_SECRET=${{ secrets.OIDC_SECRET }} \
      -e ALLOWED_MODERATORS=${{ secrets.ALLOWED_MODERATORS }} \
      -e BASE_URL=https://g21266967.duckdns.org \
      -e POST_LOGIN_REDIRECT=/moderate-ui \
      moderate-service:latest
```

---

## Video Demo Checklist

1. Show Moderate UI with "Login" button visible
2. Click Login - browser goes to Auth0
3. Enter credentials, log in
4. Show authenticated user name in header
5. Moderate a joke (approve)
6. Show History tab with moderation decisions
7. Logout
8. Show 401 when accessing /moderate without login
9. (Optional) Log in with an unauthorised email - show 403 RBAC denial
10. Show console: "OIDC authentication ENABLED via Auth0"
