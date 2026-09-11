import math
import pytest
from balancer.analysis import MAX_BYTES, MAX_ROWS, ValidationError, analyze, parse_csv, validate_records
from balancer.demo import demo_records


def records(name="Rifle", count=20, kills=10, deaths=10, **extra):
    return [dict(weapon=name, kills=kills, deaths=deaths, **extra) for _ in range(count)]


def test_aggregate_ratio_is_not_mean_of_ratios():
    rows = records(count=1, kills=10, deaths=1) + records(count=1, kills=0, deaths=9)
    result = analyze(rows)
    assert result["summary"]["kd"] == 1
    assert result["weapons"][0]["kd"] == 1


def test_tolerance_and_strict_boundary():
    rows = records("High", kills=20) + records("Low", kills=0)
    assert analyze(rows, 1)["summary"]["signals"] == 0
    result = analyze(rows, .99)
    assert result["summary"]["signals"] == 2
    assert result["weapons"][0]["status"] == "potential_overpowered"
    assert result["weapons"][1]["status"] == "potential_underpowered"
    assert analyze(rows, 5)["summary"]["signals"] == 0


@pytest.mark.parametrize("count,status", [(19, "insufficient_data"), (20, "potential_overpowered")])
def test_minimum_sample(count, status):
    result = analyze(records("A", count=count, kills=40) + records("B"), .1)
    assert result["weapons"][0]["status"] == status


def test_zero_deaths_and_empty_filter_never_nonfinite():
    result = analyze(records(deaths=0))
    assert result["summary"]["kd"] is None
    assert result["weapons"][0]["status"] == "unavailable"
    assert result["weapons"][0]["delta"] is None
    assert result["summary"]["signals"] == 0
    empty = analyze(records(), filters={"weapon": "Missing"})
    assert empty["summary"]["records"] == 0
    assert empty["weapons"] == []
    assert empty["warnings"]


def test_filter_recomputes_baseline_share_and_team_totals():
    rows = records("A", team="Blue", kills=20, damage_done=1500) + records("B", team="Red", kills=5)
    result = analyze(rows, filters={"team": "Blue"})
    assert result["summary"]["kd"] == 2
    assert result["weapons"][0]["usage_share"] == 1
    assert result["total_records"] == 40
    assert result["summary"]["records"] == 20
    assert result["teams"][0]["damage"] == 30000
    assert result["options"]["teams"] == ["Blue", "Red"]
    assert result["warnings"]  # single weapon baseline caveat


def test_partial_damage_and_optional_columns():
    result = analyze(records(count=2) + records(count=1, damage_done=300))
    assert result["summary"]["average_damage"] == 300
    assert result["summary"]["damage_records"] == 1
    assert result["teams"] == []
    assert "Damage" in result["warnings"][-1]


@pytest.mark.parametrize("value", [-1, True, "abc", None, float("nan"), float("inf"), 1_000_000_001, 1.5])
def test_invalid_kills(value):
    with pytest.raises(ValidationError, match="kills"):
        validate_records([dict(weapon="Rifle", kills=value, deaths=1)])


@pytest.mark.parametrize("value", [-1, True, "bad", None, float("nan"), 6])
def test_invalid_tolerance(value):
    with pytest.raises(ValidationError, match="Tolerance"):
        analyze(records(), value)


@pytest.mark.parametrize("filters", [[], {"unknown": "x"}, {"team": 3}])
def test_invalid_filters(filters):
    with pytest.raises(ValidationError):
        analyze(records(), filters=filters)


@pytest.mark.parametrize("raw", [b"", b"weapon,kills\nRifle,2", b'weapon,kills,deaths\n"Rifle,2,3', b"weapon,kills,deaths\nRifle,2,3,4", b"weapon,kills,deaths\nRifle,2", b"weapon,kills,deaths\n\xff,2,3", b"weapon,kills,kills,deaths\nA,1,1,2", b"weapon,kills,deaths\n,1,1"])
def test_malformed_csv(raw):
    with pytest.raises(ValidationError):
        parse_csv(raw)


def test_csv_bom_whitespace_and_unknown_columns():
    rows = parse_csv('\ufeff weapon ,kills,deaths,note\n"Rifle, Mk2",2,0,hello\n'.encode())
    assert rows == [{"weapon": "Rifle, Mk2", "kills": 2, "deaths": 0}]


def test_upload_limits():
    with pytest.raises(ValidationError, match="10 MB"):
        parse_csv(b" " * (MAX_BYTES + 1))
    with pytest.raises(ValidationError, match="50,000"):
        validate_records(records(count=MAX_ROWS + 1))
    raw = b"weapon,kills,deaths\n" + b"A,1,1\n" * MAX_ROWS
    assert len(parse_csv(raw)) == MAX_ROWS
    with pytest.raises(ValidationError, match="50,000"):
        parse_csv(raw + b"A,1,1\n")


def test_demo_is_deterministic_and_has_all_target_scenarios():
    assert demo_records() == demo_records()
    result = analyze(validate_records(demo_records()))
    assert result["summary"]["records"] == 607
    statuses = {w["status"] for w in result["weapons"]}
    assert statuses == {"within_tolerance", "potential_overpowered", "potential_underpowered", "insufficient_data"}
    assert math.isclose(sum(w["usage_share"] for w in result["weapons"]), 1)
