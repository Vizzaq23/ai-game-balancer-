"""One record describes a player's performance with one weapon in a match."""
import csv
import io
import math
from collections import defaultdict

MAX_BYTES = 10 * 1024 * 1024
MAX_ROWS = 50_000
MIN_SAMPLE = 20
REQUIRED = {"weapon", "kills", "deaths"}
METHODOLOGY = (
    "K/D is total kills divided by total deaths, not the mean of player ratios. "
    "Zero-death ratios are unavailable and excluded from ratio-based findings. "
    "Weapons with fewer than 20 records have insufficient data. Potential imbalance "
    "means weapon K/D differs from the filtered baseline by more than the selected "
    "absolute tolerance. Usage is share of uploaded records (or filtered records "
    "when filters are active), not time played. Skill, map, mode and player selection "
    "can confound these signals. K/D alone does not prove weapon strength."
)


class ValidationError(ValueError):
    def __init__(self, messages):
        self.messages = messages if isinstance(messages, list) else [messages]
        super().__init__(self.messages[0])


def parse_csv(raw):
    if len(raw) > MAX_BYTES:
        raise ValidationError("CSV exceeds the 10 MB limit.")
    try:
        reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")), strict=True)
        if not reader.fieldnames:
            raise ValidationError("CSV is empty. Include a header and at least one record.")
        headers = [h.strip() for h in reader.fieldnames]
        if len(set(headers)) != len(headers):
            raise ValidationError("CSV contains duplicate column names.")
        if not REQUIRED.issubset(headers):
            raise ValidationError("Missing required columns: " + ", ".join(sorted(REQUIRED - set(headers))))
        reader.fieldnames = headers
        rows = []
        for row in reader:
            if None in row or any(value is None for value in row.values()):
                raise ValidationError(f"CSV line {reader.line_num}: column count does not match the header.")
            rows.append(row)
            if len(rows) > MAX_ROWS:
                raise ValidationError("CSV exceeds the 50,000 row limit.")
        return validate_records(rows)
    except (UnicodeDecodeError, csv.Error) as exc:
        raise ValidationError("Use a valid UTF-8 CSV with correctly quoted values.") from exc


def validate_records(rows):
    if not isinstance(rows, list) or not rows:
        raise ValidationError("Provide a non-empty list of match records.")
    if len(rows) > MAX_ROWS:
        raise ValidationError("Data exceeds the 50,000 row limit.")
    result, errors = [], []
    for index, row in enumerate(rows, 1):
        if not isinstance(row, dict):
            raise ValidationError(f"Record {index}: expected an object.")
        item = {}
        for field in ("weapon", "player_id", "team"):
            value = row.get(field)
            if value is None or value == "":
                if field == "weapon":
                    errors.append(f"Record {index}: weapon is required.")
                continue
            if not isinstance(value, str) or not value.strip() or len(value.strip()) > 120:
                errors.append(f"Record {index}: {field} must be text between 1 and 120 characters.")
            else:
                item[field] = value.strip()
        for field in ("kills", "deaths", "damage_done"):
            value = row.get(field)
            if field == "damage_done" and (value is None or value == ""):
                continue
            try:
                number = float(value)
                if isinstance(value, bool) or not math.isfinite(number) or number < 0 or number > 1_000_000_000:
                    raise ValueError
                if field != "damage_done" and not number.is_integer():
                    raise ValueError
                item[field] = number if field == "damage_done" else int(number)
            except (ValueError, TypeError, OverflowError):
                errors.append(f"Record {index}: {field} must be a finite, non-negative {'integer' if field != 'damage_done' else 'number'} no greater than 1,000,000,000.")
        result.append(item)
        if len(errors) >= 20:
            break
    if errors:
        raise ValidationError(errors[:20])
    return result


def metrics(rows):
    kills = sum(r["kills"] for r in rows)
    deaths = sum(r["deaths"] for r in rows)
    damage = [r["damage_done"] for r in rows if "damage_done" in r]
    return {"records": len(rows), "kills": kills, "deaths": deaths,
            "kd": kills / deaths if deaths else None,
            "damage": sum(damage) if damage else None,
            "damage_records": len(damage),
            "average_damage": sum(damage) / len(damage) if damage else None}


def analyze(rows, tolerance=0.75, filters=None):
    try:
        if isinstance(tolerance, bool):
            raise ValueError
        tolerance = float(tolerance)
        if not math.isfinite(tolerance) or not 0 <= tolerance <= 5:
            raise ValueError
    except (ValueError, TypeError):
        raise ValidationError("Tolerance must be a number between 0 and 5.")
    if filters is None:
        filters = {}
    if not isinstance(filters, dict) or any(k not in ("weapon", "team") for k in filters):
        raise ValidationError("Filters support weapon and team only.")
    if any(not isinstance(v, str) for v in filters.values()):
        raise ValidationError("Filter values must be text.")
    filters = {k: v for k, v in filters.items() if v}
    selected = [r for r in rows if all(r.get(k) == v for k, v in filters.items())]
    summary = metrics(selected)
    weapons, teams = defaultdict(list), defaultdict(list)
    for row in selected:
        weapons[row["weapon"]].append(row)
        if "team" in row:
            teams[row["team"]].append(row)
    findings = []
    for name, group in sorted(weapons.items()):
        stat = metrics(group)
        delta = stat["kd"] - summary["kd"] if stat["kd"] is not None and summary["kd"] is not None else None
        if stat["records"] < MIN_SAMPLE:
            status, suggestion = "insufficient_data", "Collect more observations before drawing a balance conclusion."
        elif delta is None:
            status, suggestion = "unavailable", "Collect records with deaths to evaluate K/D."
        elif delta > tolerance:
            status, suggestion = "potential_overpowered", "Investigate skill and map effects; test a small nerf in a controlled playtest."
        elif delta < -tolerance:
            status, suggestion = "potential_underpowered", "Investigate role and player selection; test a small buff in a controlled playtest."
        else:
            status, suggestion = "within_tolerance", "No K/D signal at this tolerance. Continue monitoring broader performance."
        findings.append({"weapon": name, **stat, "delta": delta,
                         "usage_share": len(group) / len(selected), "status": status, "suggestion": suggestion})
    warnings = []
    if not selected:
        warnings.append("No records match the current filters.")
    if any(r["deaths"] == 0 for r in selected):
        warnings.append("Zero-death records are included in totals; a group with no deaths has unavailable K/D.")
    if len(weapons) == 1:
        warnings.append("Only one weapon is selected; its K/D equals the baseline. Compare multiple weapons to detect relative signals.")
    if summary["damage_records"] not in (0, len(selected)):
        warnings.append("Damage metrics cover only records with damage_done values.")
    return {"summary": {**summary, "weapons": len(weapons), "teams": len(teams),
                        "signals": sum(f["status"].startswith("potential_") for f in findings)},
            "weapons": findings, "teams": [{"team": name, **metrics(group)} for name, group in sorted(teams.items())],
            "filters": filters, "tolerance": tolerance, "total_records": len(rows),
            "options": {"weapons": sorted({r["weapon"] for r in rows}),
                        "teams": sorted({r["team"] for r in rows if "team" in r})},
            "warnings": warnings, "methodology": METHODOLOGY, "minimum_sample": MIN_SAMPLE}
