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

## Vercel frontend with Render API

**Live dashboard:** [ai-game-balancer.vercel.app](https://ai-game-balancer.vercel.app)

Project `ai-game-balancer` is deployed in the `Quintin` workspace (`quintin-b167b285`) on Hobby, tracking `main`. The initial release of commit `2389d203f0009a578e37be37c4904dd61a43faf6` passed all 10 desktop/mobile browser tests on September 10, 2026 (America/New_York). Public `/health` returned `status: ok`; an exact 10 MiB CSV with 50,000 synthetic rows and its 12.75 MB normalized JSON filter request succeeded. A CSV one byte over the limit returned the expected actionable validation error. No paid AI calls were used.

The additional Vercel deployment builds `frontend/` as a Vite application. `frontend/vercel.json` proxies `/api/*`, `/health`, and the legacy `/analyze` endpoint to the existing Render service. Analysis responses use `Cache-Control: no-store`. Flask, upload validation, and optional AI remain on Render; Vercel does not run a Python function or store uploaded records.

To reproduce this setup:

1. Import `Vizzaq23/ai-game-balancer-` from GitHub into Vercel and select `main`.
2. Set **Root Directory** to `frontend` and **Application Preset** to Vite. The checked-in configuration sets `npm ci`, `npm run build`, and `dist`.
3. Leave frontend environment variables empty. OpenAI credentials and `ENABLE_LIVE_AI` belong only on Render.
4. Deploy, then verify `/health`, demo analysis, upload, filtering, explanations, and report downloads on the assigned public domain.

This setup depends on Render availability. The dashboard can load while the free Render service wakes; analysis requests may need a retry during that period. Keep the Render service URL in `frontend/vercel.json` current if the backend moves. A direct Flask deployment to Vercel Functions would need a different upload design because of the function payload limit.

See [Vercel external rewrites](https://vercel.com/docs/routing/rewrites) and [function payload limits](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions). Roll back the frontend through Vercel's deployment history; roll back the API separately on Render.

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
