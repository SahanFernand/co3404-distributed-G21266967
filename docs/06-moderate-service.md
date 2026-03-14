# 06 - Moderate Service

**Port:** 3100 (mapped to 4100 in Docker Compose)
**Location:** `services/moderate/`

---

## What It Does

The Moderate service provides a privileged moderation interface. A human moderator reviews submitted jokes, can edit them, then approve or reject them. This implements the Event-Carried State Transfer (ECST) pattern from the assessment. The service includes RBAC (Role-Based Access Control) to restrict moderation to authorised email addresses, and a History tab to view past moderation decisions.

---

## API Endpoints

| Method | Path | Auth Required | Description |
|--------|------|:---:|-------------|
| `GET` | `/moderate` | Yes + RBAC | Pull next joke from submit queue |
| `POST` | `/moderated` | Yes + RBAC | Approve joke (send to moderated queue) |
| `POST` | `/reject` | Yes + RBAC | Reject joke (remove from queue) |
| `GET` | `/history` | Yes + RBAC | Get moderation history (approved/rejected) |
| `GET` | `/types` | No | Get types from local cache |
| `GET` | `/health` | No | Health check |
| `GET` | `/auth/status` | No | Check authentication status |
| `GET` | `/login` | No | Redirect to Auth0 login |
| `GET` | `/logout` | No | Logout and clear session |
| `GET` | `/callback` | No | Auth0 callback after login |
| `GET` | `/` | No | Serve the Moderate UI |

---

## Key Files

| File | Purpose |
|------|---------|
| `app.js` | Express server, OIDC auth, RBAC middleware, RabbitMQ integration, ECST subscription, history storage |
| `public/index.html` | Moderation UI with tabs (Pending Review / History), auth status, joke form |
| `public/script.js` | Frontend: auth check, tab switching, approve/reject logic, history rendering |
| `public/styles.css` | Blue-themed responsive CSS with mobile hamburger menu |
| `Dockerfile` | Docker image |
| `package.json` | Dependencies: express, cors, amqplib, express-openid-connect, express-session |

---

## Moderation Flow

```
1. Moderator opens Moderate UI
2. UI calls GET /auth/status to check login
3. If OIDC enabled and not logged in: shows Login button
4. After login, RBAC check: is user's email in ALLOWED_MODERATORS?
5. If not allowed: shows "Access Denied" message
6. If allowed, UI calls GET /moderate
7. If joke available in submit queue:
   - Display setup, punchline, type in editable fields
   - Types dropdown populated from /types (cache)
   - Pending count shows queue size + currently displayed joke
8. Moderator can:
   - Edit the setup, punchline, or type
   - Override type from dropdown or enter custom type
   - Click Approve: POST /moderated -> sends to moderated queue -> saved to history
   - Click Reject: POST /reject -> removes from queue -> saved to history
9. After approve/reject, UI auto-fetches next joke
10. If no jokes in queue: shows "No jokes waiting" and starts polling
```

---

## Tabs

The Moderate UI has two tabs:

- **Pending Review** - Shows the current joke for moderation, approve/reject buttons, and queue stats
- **History** - Shows all past moderation decisions (approved/rejected) with timestamps, categories, and status badges

Switching between tabs preserves the current joke being reviewed. The History tab includes a refresh button and shows running totals of approved/rejected decisions.

---

## RBAC (Role-Based Access Control)

The `ALLOWED_MODERATORS` environment variable contains a comma-separated list of email addresses that are permitted to moderate. The `requiresModerator` middleware checks the logged-in user's email against this list:

```javascript
function requiresModerator(req, res, next) {
    const userEmail = req.oidc?.user?.email;
    if (!allowedModerators.includes(userEmail)) {
        return res.status(403).json({ error: 'Access denied. Not an authorised moderator.' });
    }
    next();
}
```

Protected routes use both `requiresAuth()` (OIDC login) and `requiresModerator` (email check).

---

## Moderation History

Approved and rejected jokes are saved to a persistent JSON file (`/data/moderation-history.json`) on the Docker volume. The history stores:

- Setup, punchline, type
- Status (approved/rejected)
- Moderator name and email
- Timestamp
- Original submission time

The `GET /history` endpoint returns the history along with totals (approved count, rejected count, total). History is capped at 200 entries (oldest removed when exceeded).

---

## Polling Behaviour

When no jokes are available, the UI polls every 3 seconds:

```javascript
function startPolling() {
    if (pollingInterval) return;
    pollingInterval = setInterval(fetchJoke, 3000);
}

function stopPolling() {
    clearInterval(pollingInterval);
    pollingInterval = null;
}
```

The polling indicator (3 animated dots) shows the user that the system is checking for new submissions.

---

## ECST Type Update Subscription

Like the Submit service, the Moderate service subscribes to `type_update` events:

```javascript
await rabbitChannel.assertExchange('type_update', 'fanout', { durable: true });
const { queue } = await rabbitChannel.assertQueue('moderate_type_updates', {
    exclusive: false, durable: true
});
await rabbitChannel.bindQueue(queue, 'type_update', '');
```

When a new type is detected by ETL, the Moderate service updates its local types cache, and the dropdown is refreshed on the next `/types` call.

---

## Queue Operations

**GET /moderate (pull from queue):**

```javascript
const msg = await rabbitChannel.get(SUBMIT_QUEUE, { noAck: false });
if (msg) {
    const joke = JSON.parse(msg.content.toString());
    joke._deliveryTag = msg.fields.deliveryTag;
    return res.json({ joke, queueSize: await getQueueSize() });
}
```

The `_deliveryTag` is returned to the client so it can be sent back when approving/rejecting, allowing the server to acknowledge the correct message.

**POST /moderated (approve):**

```javascript
// Send to moderated queue for ETL
await sendToQueue(MODERATED_QUEUE, message);

// Save to moderation history
await addToHistory(setup, punchline, type, 'approved', moderatorName, moderatorEmail);

// Acknowledge original message (remove from submit queue)
rabbitChannel.ack({ fields: { deliveryTag: _deliveryTag } });
```

---

## Session Stats

The UI tracks approved and rejected counts per browser session (displayed in the stats card). The History tab also shows all-time totals from the persistent history.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | Server port |
| `RABBITMQ_URL` | `amqp://guest:guest@rabbitmq:5672` | RabbitMQ connection |
| `TYPES_CACHE_FILE` | `/data/types-cache.json` | Path to types cache file |
| `HISTORY_FILE` | `/data/moderation-history.json` | Path to moderation history file |
| `OIDC_CLIENT_ID` | _(empty)_ | Auth0 Client ID (enables OIDC) |
| `OIDC_ISSUER` | _(empty)_ | Auth0 Issuer URL (enables OIDC) |
| `OIDC_SECRET` | _(empty)_ | Auth0 Client Secret |
| `BASE_URL` | `http://localhost:3100` | Public URL for callbacks |
| `POST_LOGIN_REDIRECT` | `/` | Where to redirect after login |
| `ALLOWED_MODERATORS` | _(empty)_ | Comma-separated list of allowed moderator emails |

When `OIDC_CLIENT_ID` and `OIDC_ISSUER` are both empty, the service runs in development mode with mock authentication.

---

## Business Continuity

The assessment requires: "If the joke service and/or submit service is down, the moderator should still be able to submit new joke and type as a business continuity workaround."

This works because:
- The Moderate service connects directly to RabbitMQ (not through other services)
- Types are cached locally in `/data/types-cache.json`
- POST /moderated writes to the moderated queue, which ETL will process when it comes back online
