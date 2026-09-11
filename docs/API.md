# API contract

All v1 successes return `{ "data": ..., "errors": [] }`. Errors return `{ "data": null, "errors": ["Actionable message"] }` with an appropriate HTTP status. Unknown API routes return 404. Validation failures return 400, oversized requests 413, and unsupported request media types 415.

## Endpoints

| Method | Path | Input | Result in `data` |
| --- | --- | --- | --- |
| GET | `/health` | None | `{ "status": "ok" }` |
| GET | `/api/v1/demo` | None | `{ "records": [...], "synthetic": true, "name": "Synthetic arena playtest" }` |
| POST | `/api/v1/analyze` | JSON or multipart CSV | `{ "analysis": {...}, "records": [validated records] }` |
| POST | `/api/v1/explanations` | Same as analysis | `{ "source": "built_in" or "openai", "text": "...", "notice": "optional fallback reason" }` |
| POST | `/analyze` | Same as analysis | Legacy top-level list: `[{ "weapon": "...", "status": "...", "suggestion": "..." }]` |

JSON example:

```json
{
  "data": [
    { "weapon": "Rifle", "kills": 12, "deaths": 10, "player_id": "P001", "team": "Atlas", "damage_done": 1450 }
  ],
  "tolerance": 0.75,
  "filters": { "weapon": "", "team": "" }
}
```

For multipart, send `file` (UTF-8 CSV), `tolerance` (numeric text), and `filters` (JSON text). CSV size is limited to 10 MiB, with 50,000 records maximum. JSON envelopes are capped at 32 MiB because normalization repeats field names. Returned normalized records can be reused for filtering and explanation requests. Files and records are never persisted.

Required fields: `weapon`, `kills`, `deaths`. Optional fields: `player_id`, `team`, `damage_done`. Unknown record fields are discarded. Headers are trimmed and a UTF-8 BOM is accepted. Duplicate columns, broken quoting, inconsistent column counts, missing values in required fields, and non-finite or negative numbers are rejected. Text values must contain 1–120 characters. Kills/deaths must be integers; damage may be fractional. Numeric values must not exceed 1,000,000,000. Up to 20 validation messages are returned per request; no invalid rows are silently dropped.

`tolerance` is a finite absolute K/D difference between 0 and 5, default 0.75. Filters support exact weapon and team strings; omitted or empty strings mean all. An empty selection returns an empty analysis with a warning, not an error. Filter options always come from the entire uploaded dataset.

## Analysis

`analysis` contains `summary`, `weapons`, `teams`, `filters`, `tolerance`, `total_records`, `options`, `warnings`, `methodology`, and `minimum_sample`.

Metrics include record count, kills, deaths, aggregate `kd`, total `damage`, `damage_records`, and `average_damage`. Missing ratios/damage use JSON `null`, never NaN or Infinity. Weapon metrics add `weapon`, `delta` (weapon K/D minus selection baseline), `usage_share` (0–1), `status`, and `suggestion`. Team metrics add `team`; rows without teams are excluded from the team breakdown. Partial damage averages use only records with damage values, with coverage reported explicitly.

| Status | Meaning |
| --- | --- |
| `insufficient_data` | Fewer than 20 records; no balance classification |
| `unavailable` | No deaths in the group, so K/D cannot be evaluated |
| `potential_overpowered` | K/D exceeds the baseline plus tolerance |
| `potential_underpowered` | K/D is below the baseline minus tolerance |
| `within_tolerance` | No qualifying K/D difference at this setting |

The minimum-sample rule takes precedence over ratio availability. Equality to a tolerance boundary is within tolerance. Zero-death rows still contribute kills to group and baseline totals; only groups with zero total deaths have unavailable K/D. The baseline includes all selected records, including small-sample weapons. No inferential confidence or causal effect is claimed.

The legacy endpoint keeps its original list shape and maps potential signals to `overpowered`/`nerf`, `underpowered`/`buff`, and within-tolerance findings to `balanced`/`none`. Insufficient or unavailable findings use `collect_more_data`. Clients should migrate to v1 to expose the supporting evidence and limitations.

## Optional explanations

The explanation endpoint recomputes the analysis from validated input. It never trusts caller-supplied conclusions. Live AI requires `ENABLE_LIVE_AI=true`, `OPENAI_API_KEY`, and `OPENAI_MODEL`. Only aggregate summary, weapon findings, tolerance, and methodology are sent. Player IDs, raw records, team labels, and filenames are excluded. Weapon labels remain in the aggregate evidence; the model is instructed to treat them as untrusted data.

The OpenAI call has a 20-second timeout, no retries, `store=false`, a 700-token output cap, and a 100-weapon input limit. Provider failure, empty output, missing configuration, or the hourly cap produces a labeled built-in explanation. No paid API call is made by default.

The reference deployment permits at most 20 live explanation attempts per hour, globally per worker, with one Gunicorn worker. This is a conservative demo safeguard, not a distributed quota: restarts reset it and additional workers multiply it. Configure provider project budgets before enabling paid AI publicly; a larger deployment needs a shared quota store.
