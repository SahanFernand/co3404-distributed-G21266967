# 13 - Troubleshooting

---

## Docker / Docker Compose

**"Cannot connect to database"**
- The database container needs time to start. The compose file uses healthcheck + `depends_on` to handle this.
- Check that `DB_HOST` matches the service name in compose (`mysql` or `mongodb`).
- If using MongoDB, ensure `DB_TYPE=mongo` is set.

**Types dropdown is empty**
- Check the `/types` endpoint returns data.
- Check browser console for CORS errors.
- If Joke service is down, Submit uses cached types. If cache is empty, defaults are used.

**"Connection refused" to RabbitMQ**
- RabbitMQ takes 15-30 seconds to start. Services have retry logic (10 retries, 5s delay).
- Check RabbitMQ container is running: `docker ps | grep rabbitmq`

**Port already in use**
- Stop existing containers: `docker compose down`
- Check for processes on the port: `lsof -i :4000`

**Changes not reflected after rebuild**
- Use `--build` flag: `docker compose --profile mysql up --build`
- Clear volumes if needed: `docker compose --profile mysql down -v`

---

## Auth0 / OIDC

**"Callback URL mismatch" error**
- Go to Auth0 Dashboard > Applications > Your App > Settings
- Add the exact callback URL to "Allowed Callback URLs"
- Must include `/callback` path (e.g., `http://localhost:4100/callback`)
- For Azure: add both `http://localhost:4100/callback` AND `https://g21266967.duckdns.org/callback`

**Login loop (keeps redirecting to login)**
- Check that `BASE_URL` matches the URL you are accessing from
- If using Kong: `BASE_URL=https://g21266967.duckdns.org`
- If direct access: `BASE_URL=http://localhost:4100`

**Session not persisting**
- Check cookies in browser dev tools (Application > Cookies)
- Ensure `trust proxy` is set when behind Kong (already configured)
- Try clearing browser cookies and logging in again

**OIDC not enabling**
- Both `OIDC_CLIENT_ID` and `OIDC_ISSUER` must be set and non-empty
- Check container logs: `docker compose logs moderate`
- Should show "OIDC authentication ENABLED via Auth0"

**401 on all requests**
- Verify you are logged in (check `/auth/status`)
- Ensure your Auth0 application type is "Regular Web Applications"

**403 Forbidden (RBAC)**
- Your email is not in the `ALLOWED_MODERATORS` list
- Check the `ALLOWED_MODERATORS` GitHub Secret contains your email (comma-separated)
- The email check is case-insensitive

---

## HTTPS / SSL

**"Not Secure" warning in browser**
- SSL certificate may not have been provisioned yet
- Check that `setup-ssl.sh` ran successfully during deployment
- Verify certificate exists: `ssh -i ssh_key.pem azureuser@<KONG_IP> "ls /etc/letsencrypt/live/g21266967.duckdns.org/"`

**SSL certificate renewal**
- Certificates from Let's Encrypt are valid for 90 days
- The CI/CD pipeline renews on each deployment
- Manual renewal: SSH to Kong VM and run `sudo certbot renew`

**DuckDNS domain not resolving**
- Check that the DuckDNS token and domain are correctly configured
- Verify the IP is updated: `nslookup g21266967.duckdns.org`

---

## Rate Limiting

**Getting 429 Too Many Requests**
- Kong rate limits all services. Limits per minute:
  - Joke: 60, Submit: 60, Moderate: 100, RabbitMQ Admin: 50, RabbitMQ Assets: 100
- Wait 1 minute for the limit to reset
- The rate limit is per client IP

---

## RabbitMQ

**Messages stuck in queue**
- Check ETL container is running: `docker ps | grep etl`
- Check ETL logs: `docker compose logs etl`
- ETL might be unable to connect to database

**Queue not created**
- Queues are auto-created by services on first connection
- If RabbitMQ was restarted with a clean volume, services need to reconnect

**Management UI not loading**
- Port 15672 must be exposed: check `docker ps`
- Via Kong: access at `https://g21266967.duckdns.org/rmq`
- Credentials are stored as GitHub Secrets (not default guest/guest on Azure)

**Management UI assets not loading (blank page)**
- Kong needs the `rabbitmq-assets` service configured to proxy `/js`, `/css`, `/img`, `/api`
- Check `kong.yaml` has the `rabbitmq-assets` service entry

---

## Moderation History

**History not showing**
- Ensure the `/data` volume is mounted on the Moderate VM
- Check that `moderation-history.json` exists: SSH to Moderate VM and check `/home/azureuser/data/`
- The History tab requires authentication (must be logged in)

**History data lost**
- History is stored in `/data/moderation-history.json` on a Docker volume
- If the container was recreated with `-v` flag, the volume was deleted
- History is capped at 200 entries (oldest removed automatically)

---

## Terraform

**"Error: Provider produced inconsistent result"**
- Run `terraform plan` again, then `terraform apply`
- If persistent, destroy and recreate: `terraform destroy && terraform apply`

**VM not accessible via SSH**
- Wait 2-3 minutes for cloud-init to complete
- Check NSG allows port 22
- Verify the SSH key: `ssh -i ssh_key.pem azureuser@<IP>`
- If key mismatch, destroy and recreate

**Docker not installed on VM**
- Cloud-init can take 2-3 minutes after VM creation
- SSH in and check: `docker --version`
- If not installed, run manually:
  ```bash
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER
  ```

**Azure credits running out**
- Use `stop.sh` to deallocate VMs when not in use (preserves infrastructure)
- Use `start.sh` to restart VMs when needed
- Use `terraform destroy` to remove everything

---

## CI/CD Pipeline

**SSH connection refused in pipeline**
- VMs might not be running. Check Azure Portal or run `start.sh`.
- Verify `KONG_PUBLIC_IP` secret is correct
- Check `SSH_PRIVATE_KEY` secret contains the full key (including BEGIN/END lines)

**Docker pull fails on VM**
- VM might still be running cloud-init
- SSH in and check Docker is installed
- Images are on GitHub Container Registry (ghcr.io), not Docker Hub
- The pipeline makes packages public after pushing

**Build job fails**
- Check that Dockerfiles exist at expected paths
- The pipeline uses `GITHUB_TOKEN` for ghcr.io authentication (automatic)

**Deploy job fails**
- Check that VMs are running and accessible
- The deploy job SSHs directly to each VM's public IP (no jump host)
- Check GitHub Secrets for correct VM public IPs

---

## Database

**MySQL "Access denied"**
- Check credentials match: `jokeuser` / `jokepassword`
- Ensure `MYSQL_USER` and `MYSQL_PASSWORD` env vars are set on the MySQL container

**MongoDB "connection refused"**
- Ensure `DB_TYPE=mongo` is set
- Check `MONGO_URL` points to the right host (default: `mongodb://mongodb:27017`)

**Data lost after restart**
- Use named volumes (configured in docker-compose.yml)
- Do NOT use `docker compose down -v` (the `-v` flag removes volumes)
- Use `docker compose down` (without `-v`) to preserve data

---

## General

**Service not responding**
- Check container is running: `docker ps`
- Check logs: `docker compose logs <service-name>`
- Check health endpoint: `curl http://localhost:<port>/health`

**CORS errors in browser**
- Kong has CORS restricted to `g21266967.duckdns.org` and the Kong public IP
- If accessing services directly (not through Kong), each service also has `cors()` middleware
- Check browser console for the specific CORS error
