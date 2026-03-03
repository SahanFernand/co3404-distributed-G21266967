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
- For Azure: add both `http://localhost:4100/callback` AND `http://<KONG_IP>/callback`

**Login loop (keeps redirecting to login)**
- Check that `BASE_URL` matches the URL you are accessing from
- If using Kong: `BASE_URL=http://<KONG_IP>/moderate-ui`
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
- Default credentials: guest / guest

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
- Always `terraform destroy` when not using VMs
- Stop VMs in Azure Portal when pausing work

---

## CI/CD Pipeline

**SSH connection refused in pipeline**
- VMs might not be running. Check Azure Portal.
- Verify `KONG_PUBLIC_IP` secret is correct
- Check `SSH_PRIVATE_KEY` secret contains the full key (including BEGIN/END lines)

**Docker pull fails on VM**
- VM might still be running cloud-init
- SSH in and check Docker is installed
- Verify `DOCKER_USERNAME` secret matches Docker Hub account

**Build job fails**
- Check that Dockerfiles exist at expected paths
- Verify `DOCKER_PASSWORD` is a Docker Hub access token (not password)

**Deploy job fails**
- Check that VMs are running and accessible
- The deploy job uses nested SSH (Kong as jump host) - ensure Kong can reach internal VMs

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
- Kong has global CORS configured. If accessing services directly (not through Kong), each service also has `cors()` middleware.
- Check browser console for the specific CORS error.
