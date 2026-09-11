"""Deterministic synthetic observations, not real game telemetry."""
import random


def demo_records():
    rng = random.Random(42)
    rows = []
    for weapon, count, kill_base, death_base, damage_base in [
        ("Vanguard AR", 160, 13, 12, 1650), ("Spectre SMG", 140, 12, 12, 1380),
        ("Longbow SR", 100, 26, 10, 2450), ("Breach SG", 110, 11, 12, 1490),
        ("Sidekick MK2", 85, 4, 14, 720), ("Arc Prototype", 12, 20, 8, 2100),
    ]:
        for i in range(count):
            rows.append({"player_id": f"P{rng.randint(1, 180):03d}",
                         "team": "Ember" if i % 2 else "Atlas", "weapon": weapon,
                         "kills": max(0, kill_base + rng.randint(-4, 4)),
                         "deaths": max(0, death_base + rng.randint(-3, 3)),
                         "damage_done": max(0, damage_base + rng.randint(-300, 300))})
    rng.shuffle(rows)
    return rows
