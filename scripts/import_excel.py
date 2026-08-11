"""Import Excel file into JSON dataset."""

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.data_store import dataset_exists, save_dataset
from lib.excel_parser import read_excel


def import_file(filepath: str, overwrite: bool = False):
    filepath = Path(filepath)
    if not filepath.exists():
        print(f"File not found: {filepath}")
        sys.exit(1)

    meta_check = dataset_exists
    parsed = read_excel(filepath)

    if dataset_exists(parsed["server_id"], parsed["dataset_key"]) and not overwrite:
        print(f"Dataset already exists: {parsed['dataset_key']}")
        print("Use --overwrite to replace.")
        sys.exit(1)

    parsed["imported_at"] = datetime.now(timezone.utc).isoformat()
    path = save_dataset(parsed)
    print(f"Imported {parsed['player_count']} players")
    print(f"Server: {parsed['server_id']}")
    print(f"Period: {parsed['date_from']} -> {parsed['date_to']}")
    print(f"Saved to: {path}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/import_excel.py <file.xlsx> [--overwrite]")
        sys.exit(1)

    filepath = sys.argv[1]
    overwrite = "--overwrite" in sys.argv
    import_file(filepath, overwrite)
