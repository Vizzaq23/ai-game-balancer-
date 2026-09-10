"""CLI using the dashboard's validation and analysis."""
import argparse
import json
from pathlib import Path
from balancer.analysis import analyze, parse_csv, ValidationError

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyze weapon balance from a CSV")
    parser.add_argument("csv", nargs="?", default="match_data.csv")
    parser.add_argument("--tolerance", type=float, default=0.75)
    args = parser.parse_args()
    try:
        print(json.dumps(analyze(parse_csv(Path(args.csv).read_bytes()), args.tolerance), indent=2))
    except (ValidationError, OSError) as exc:
        parser.exit(1, f"Error: {exc}\n")
