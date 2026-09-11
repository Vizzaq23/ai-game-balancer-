# Release and hosting

The app runs as one Docker service: Vite builds static assets; Flask serves those assets and the API through Gunicorn. No database, persistent disk, CORS setup, or frontend secrets are needed.

## Render

**Live service:** [ai-game-balancer.onrender.com](https://ai-game-balancer.onrender.com)

The initial release was created through Render's Git Provider web-service flow using Docker, the free plan, branch `codex/portfolio-revamp`, `/health`, `ENABLE_LIVE_AI=false`, and **After CI Checks Pass** auto-deploys. These settings match `render.yaml`; the current service is not managed by a Blueprint. Service ID: `srv-dahkfgafngtc73ct03dg`.

The deployed application passed all 10 desktop/mobile workflow tests on September 10, 2026 (America/New_York), and `/health` returned `status: ok`. The backend's 49 tests passed, and GitHub Actions verified the Linux build and Docker startup. The original implementation commit is `c7924d5ad86ed5d4c11865b7439a471261717715`.

To reproduce the deployment with a Blueprint:

1. Push the tested branch to GitHub and authorize Render for this repository.
2. Create a Blueprint from the repository and choose `main`. `render.yaml` creates a free Docker web service with `/health` checks and live AI disabled.
3. Wait for the build and deployment to complete. Use the URL assigned by Render; do not assume the service name is an available hostname.
4. Verify `/health`, load the demo, upload the CSV template, adjust filters, and download the HTML report on the live URL.
5. Add the verified URL to the README. Keep the service tracking `main` for future releases.

The configuration uses `autoDeployTrigger: checksPass`, so subsequent automatic deployments wait for checks. See [Render's Docker documentation](https://render.com/docs/docker) and [Blueprint specification](https://render.com/docs/blueprint-spec) for platform details. The free plan may sleep when idle; initial requests can take longer. Do not enable a paid plan without reviewing its price.

## Run the same image locally

```sh
docker build -t ai-game-balancer .
docker run --rm -p 10000:10000 -e ENABLE_LIVE_AI=false ai-game-balancer
```

Open `http://localhost:10000`. The container runs as a non-root user, binds to `$PORT`, and has an HTTP health check. Gunicorn uses one worker with four threads and a 60-second timeout. Application debug mode is disabled.

## Release verification

GitHub Actions runs Python tests, the TypeScript/Vite build, desktop/mobile Chromium workflows, accessibility checks, and an actual Docker build/startup check. Browser failure traces are retained as CI artifacts. Do not claim a Docker deployment was verified based only on local Flask startup.

For an already running deployment, run the browser suite against its URL with live AI disabled:

```powershell
cd frontend
$env:BASE_URL = "https://YOUR-VERIFIED-SERVICE.onrender.com"
npm run test:e2e
```

The tests upload synthetic fixtures and do not save server data. For a production instance with paid AI enabled, use an isolated test deployment instead.

## Monitoring and rollback

Use Render's health status and deployment/access logs for availability. The application does not log uploads or persist match data. Infrastructure access logs still contain request metadata. AI provider failures fall back to built-in explanations; the UI states when that happens. Keep `ENABLE_LIVE_AI=false` until optional provider configuration and cost limits are intentional.

Rollback by redeploying the previous successful image/commit in Render, or reverting the release commit. There are no database migrations. The `/analyze` compatibility endpoint remains available, but its new insufficient-data behavior is intentional and documented in `API.md`.
