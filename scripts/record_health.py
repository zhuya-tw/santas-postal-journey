"""Record one successful catalogue health check per Taipei calendar month."""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "manual/last-health-check.json"
CATALOG = ROOT / "site/data/catalog.json"

month = os.environ["CHECK_MONTH"]
if REPORT.exists() and json.loads(REPORT.read_text(encoding="utf-8"))["month"] == month:
    raise SystemExit(0)

catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
record = {
    "month": month,
    "checked_commit": os.environ["CHECK_COMMIT"],
    "catalogue_tests": "passed",
    "office_count": len(catalog["offices"]),
    "cutoff_years": sorted(catalog["taiwan"]),
}
REPORT.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
