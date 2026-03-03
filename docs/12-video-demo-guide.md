# 12 - Video Presentation Guide

**Duration:** Up to 15 minutes for Option 4
**Format:** MP4 file (NOT a YouTube link, NOT inside the zip)

---

## Suggested Script (Option 4 - Very High 1st, ~14 minutes)

### [0:00 - 1:00] Introduction

- Introduce yourself and state Option 4
- State your proposed grade and reference specific requirements met
- Show the architecture diagram (from assessment PDF)

### [1:00 - 3:00] Option 1: Joke + Submit Services

- Show Joke UI: select type, click Get Joke
  - Setup appears first, punchline reveals after 3 seconds
- Show types dropdown reloads dynamically when opened
- Show Postman: `GET /joke/any?count=3` returns 3 jokes
- Show Submit UI: fill in setup, punchline, select/create type, submit
- Show Swagger docs at `/docs`, test an endpoint
- Show database: tables structure, data, new joke present

### [3:00 - 5:00] Option 2: RabbitMQ + ETL + Resilience

- Show RabbitMQ Management (http://localhost:15672)
- **Resilience demo:**
  - Stop the Joke container: `docker stop joke`
  - Show Submit UI still works (types load from cache)
  - Submit a joke - show message appears in RabbitMQ queue
  - Restart: `docker start joke`
  - Show ETL consumes queued messages
  - Show types cache refreshes

### [5:00 - 7:00] Option 3: Kong API Gateway

- Show Kong routing: single IP serves all services
- Show rate limiting:
  - Run 25 requests to `/joke/general`
  - Show 429 error after 20 requests
- Show `kong.yaml` configuration briefly
- Show Terraform files and mention IaC approach

### [7:00 - 9:00] Option 4 - Low 1st: Moderate Service

- Show the complete moderation flow:
  - Submit a joke via Submit UI
  - Show message in RabbitMQ `submit` queue
  - Open Moderate UI, joke appears
  - Edit the joke if desired
  - Click Approve
  - Show message moves to `moderated` queue
  - ETL processes it, joke appears in database
- Show type_update event:
  - Submit joke with a NEW type
  - Show type appears in Moderate dropdown (ECST)

### [9:00 - 10:00] Option 4 - Mid 1st: Dual Database

- Show `DB_TYPE=mysql` in configuration
- Demonstrate the service working with MySQL
- Tear down and switch to MongoDB: `DB_TYPE=mongo`
- Show the service working with MongoDB
- Show `database/index.js` abstraction layer code

### [10:00 - 12:00] Option 4 - High 1st: CI/CD Pipeline

- Show `.github/workflows/deploy.yml` file
- Make a small code change
- Commit and push to GitHub
- Show GitHub Actions tab with pipeline running
- Show both jobs completing
- Show deployed app on Azure (or show previous successful run)
- (You can pause recording during lengthy processes)

### [12:00 - 13:30] Option 4 - Very High 1st: OIDC Authentication

- Show Moderate UI with "Login" button
- Click Login - browser redirects to Auth0
- Enter credentials, log in
- Show authenticated user name in header
- Moderate a joke to prove access works
- Logout
- Try accessing `/moderate` without login - show 401
- Show console output: "OIDC authentication ENABLED via Auth0"

### [13:30 - 14:30] Code Discussion

- Show how DB switching works (`database/index.js`)
- Show type_update pub/sub in `etl.js`
- Show RabbitMQ connection retry logic
- Mention challenges overcome
- Do NOT read code line by line - explain concepts

### [14:30 - 15:00] Conclusion

- Summarise what was demonstrated
- Reference the report for detailed implementation discussion

---

## Video Tips

- **Write a script and follow it.** This prevents rambling.
- **Speak quickly but clearly.** You have a lot to cover in 15 minutes.
- **Do NOT read code line by line.** Instead: "Here I use a connection pool for efficiency because..."
- **Pause recording** during lengthy processes (VM creation, Docker builds).
- **Show don't tell** - demonstrate every requirement working.
- **Test everything before recording** to avoid live debugging.
- **Use screen recording software** (OBS, QuickTime, or similar).

---

## Non-Functional Requirements to Demonstrate

- [ ] Services continue when others are stopped
- [ ] Data persists through container restart
- [ ] Types cache works when Joke service is down
- [ ] RabbitMQ queues are durable (survive restart)
- [ ] Rate limiting works (429 after limit)
- [ ] Both databases work (MySQL and MongoDB)
- [ ] OIDC authentication blocks unauthenticated access
- [ ] CI/CD pipeline builds and deploys automatically
