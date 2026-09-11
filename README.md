# AI Game Balancer

**A balance studio for multiplayer playtests.** Upload match observations, inspect weapon and team performance, and turn potential balance signals into a better next experiment.

Built by [Quintin Vizza](https://www.linkedin.com/in/Quintin-Vizza). React + TypeScript dashboard, Flask API, deterministic analysis, and optional AI explanations.

![Balance Studio dashboard](assets/studio-dashboard.png)

**[Try the live Balance Studio →](https://ai-game-balancer.onrender.com)**

Hosted on Render's free plan. The first visit after inactivity can take around a minute to wake the service. Live AI is disabled; built-in explanations work without an API key. The public deployment passed all 10 desktop/mobile browser workflow tests, including accessibility and export checks.

## What you can do

- Explore 607 reproducible **synthetic** playtest records across six weapons and two teams, without an API key or sign-up.
- Upload a UTF-8 CSV, validate its records, and filter by weapon or team.
- Compare aggregate K/D, record share, sample counts, damage coverage, and team totals.
- Adjust an absolute K/D tolerance and inspect potential imbalance signals with their evidence.
- Search and paginate the underlying records. Export weapon metrics as CSV and a standalone HTML report with context, methodology, and explanations.
- Request built-in explanations by default, or configure optional server-side OpenAI explanations.

Uploads exist only in memory. There are no accounts, saved datasets, billing, patch comparisons, or predictive balance simulations.

<details>
<summary>Welcome screen and mobile layout</summary>

![Welcome screen](assets/studio-welcome.png)

<img src="assets/studio-mobile.png" alt="Mobile dashboard" width="320" />
</details>

## Run locally on Windows

Install Python 3.12 and Node.js 22 or newer, then run in PowerShell:

```powershell
git clone https://github.com/Vizzaq23/ai-game-balancer-.git
cd ai-game-balancer-
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
cd frontend
npm ci
npm run build
cd ..
.\.venv\Scripts\python.exe api.py
```

Open [localhost:5000](http://localhost:5000). Click **Explore demo data** or **Upload CSV**. No `.env` file or paid AI service is required. This local server is for development; deployment uses Gunicorn in Docker.

On macOS/Linux, create the same virtual environment and use `.venv/bin/python` in place of `.\.venv\Scripts\python.exe`.

For frontend development, keep Flask running and run `npm run dev` in a second terminal inside `frontend/`. Open the Vite URL printed in that terminal; its `/api` requests proxy to Flask on port 5000.

## Your CSV

```csv
player_id,team,weapon,kills,deaths,damage_done
P001,Atlas,Rifle,12,10,1450
P002,Ember,SMG,10,12,1220
```

Only `weapon`, `kills`, and `deaths` are required. The other columns are optional. One row should represent one player's performance with one weapon in one match; a row is **not necessarily a unique match or player**. Unknown columns are ignored. Download a template from the welcome screen or methodology dialog.

CSV limits: **10 MiB / 50,000 rows**. Text fields must contain 1–120 characters. Kills/deaths are non-negative whole numbers; damage is a non-negative number. Missing required values, invalid numbers, malformed quoting, and duplicate headers return actionable errors. The original eight-row `match_data.csv` remains available, but its weapons correctly receive insufficient-data labels.

## How the analysis works

1. Apply the weapon/team filters, then calculate the baseline as **total kills ÷ total deaths**.
2. Calculate the same aggregate ratio for each weapon. This avoids averaging individual K/D ratios with very different denominators.
3. Require at least **20 records** for a weapon before flagging it. This is a transparent minimum-sample rule, not a statistical confidence guarantee.
4. Flag a potential imbalance only when the weapon's K/D differs from the selection baseline by **more than** the absolute tolerance (default **0.75**, range 0–5).
5. Show zero-death group ratios as **N/A** and omit ratio-based recommendations. Individual zero-death rows still contribute to totals.

Record share means a share of uploaded observations (or the filtered subset), **not time played**. Partial damage metrics report coverage. Team performance is descriptive and does not imply win rates or matchmaking quality. Selecting one weapon makes its K/D equal the baseline, so compare multiple weapons to evaluate relative performance.

Skill, map, mode, weapon roles, repeated players, and selection bias can explain apparent differences. K/D does not prove a weapon is too strong or prescribe an exact damage change. Treat findings as prompts for controlled playtests.

## What “AI” means here

The calculations and classifications are deterministic; they do not use a trained predictive model. The optional AI layer explains the computed evidence and proposes experiments. The UI explicitly distinguishes **built-in** and **AI-generated** explanations.

To opt in, copy `.env.example` to `.env`, set `ENABLE_LIVE_AI=true`, supply your server-side `OPENAI_API_KEY`, and choose an available `OPENAI_MODEL`. Restart Flask. Do not put secrets in frontend variables or commit `.env`. API usage may incur charges.

Only aggregate weapon findings are sent to OpenAI—never player IDs or raw records. Explanation calls run only on request, with a timeout and conservative hourly cap. Missing credentials or provider failures keep the dashboard usable through built-in explanations. See [API details](docs/API.md) for limits and behavior.

## Verification

With Flask serving the production build:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
cd frontend
npm run build
npx playwright install chromium
npm run test:e2e
```

The tests cover calculation boundaries, minimum samples, zero deaths, validation and upload limits, filtering, API compatibility, mocked AI success/failure, complete desktop/mobile workflows, exports, keyboard interaction, and WCAG accessibility checks. No paid API calls are required.

To regenerate screenshots from the running app: `node scripts/capture.mjs` inside `frontend/`. Screenshots use synthetic data. Python dependencies are pinned in `requirements*.txt` and frontend dependencies in `frontend/package-lock.json`. Update Python locks deliberately with `pip-compile requirements.in -o requirements.txt` and `pip-compile requirements-dev.in -o requirements-dev.txt` after installing `pip-tools`.

## Architecture and deployment

```text
React dashboard → Flask API → shared validation + analysis
                           → optional aggregate-only AI explanation
```

`balancer/` holds the shared Python engine; `api.py` exposes the API and serves the built frontend. The CLI (`python analyze_data.py match_data.csv`) uses the same engine. `frontend/` uses React, TypeScript, Vite, Tailwind, Recharts, and Lucide icons. Versioned interfaces and the legacy `/analyze` adapter are documented in [API.md](docs/API.md).

The Docker image builds the frontend and serves both UI and API as one non-root service. `render.yaml` configures Render with live AI disabled. GitHub Actions checks the app and container. See [deployment, verification, and rollback instructions](docs/DEPLOYMENT.md).

This revamp preserves the original Flask/Streamlit prototype in Git history while replacing its duplicated calculations, ignored sensitivity setting, raw debugging output, and missing dependency setup.
