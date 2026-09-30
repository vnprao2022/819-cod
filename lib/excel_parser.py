"""Excel file parsing and validation."""

import re
from pathlib import Path

import openpyxl

from lib.column_mapper import REQUIRED_COLUMN, build_column_map, parse_value

FILENAME_PATTERN = re.compile(
    r"^(?P<server_id>\d+)_(?P<date_from>\d{4}-\d{2}-\d{2})_(?P<date_to>\d{4}-\d{2}-\d{2})\.xlsx$",
    re.IGNORECASE,
)


def parse_filename(filename: str) -> dict | None:
    """Parse server_id, date_from, date_to from Excel filename."""
    match = FILENAME_PATTERN.match(Path(filename).name)
    if not match:
        return None
    return {
        "server_id": match.group("server_id"),
        "date_from": match.group("date_from"),
        "date_to": match.group("date_to"),
        "dataset_key": f"{match.group('date_from')}_{match.group('date_to')}",
    }


def read_excel(filepath: str | Path, source_filename: str | None = None) -> dict:
    """Read Excel file and return parsed dataset."""
    filepath = Path(filepath)
    meta = parse_filename(source_filename or filepath.name)
    if not meta:
        raise ValueError(
            "Invalid filename. Required format: SERVER_STARTDATE_ENDDATE.xlsx"
        )

    wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    if not rows:
        raise ValueError("Excel file is empty.")

    headers = [str(h).strip() if h else "" for h in rows[0]]
    if REQUIRED_COLUMN not in headers:
        raise ValueError(f'Excel must contain column "{REQUIRED_COLUMN}".')

    col_map = build_column_map(headers)
    role_id_col = next(
        (idx for idx, c in col_map.items() if c["field"] == "role_id"), None
    )

    players = []
    duplicates = []
    seen_ids = set()
    warnings = []

    for row_idx, row in enumerate(rows[1:], start=2):
        if not row or all(c is None or str(c).strip() == "" for c in row):
            continue

        player = {}
        for col_idx, col_info in col_map.items():
            val = row[col_idx] if col_idx < len(row) else None
            player[col_info["field"]] = parse_value(col_info["field"], val)

        # Newer CoD Game Tools exports split deaths and healing into T4/T5
        # columns. Keep the components, and also restore the aggregate fields
        # used by the dashboard and the existing ranking UI.
        if "deaths" not in player and ({"deaths_t4", "deaths_t5"} & set(player)):
            player["deaths"] = (player.get("deaths_t4", 0) or 0) + (player.get("deaths_t5", 0) or 0)
        if "healing" not in player and ({"healing_t4", "healing_t5"} & set(player)):
            player["healing"] = (player.get("healing_t4", 0) or 0) + (player.get("healing_t5", 0) or 0)
        if {"severely_wounded_t4", "severely_wounded_t5"} & set(player):
            player["severely_wounded"] = (
                (player.get("severely_wounded_t4", 0) or 0)
                + (player.get("severely_wounded_t5", 0) or 0)
            )

        role_id = player.get("role_id", "")
        if not role_id:
            warnings.append(f"Row {row_idx}: missing role_id, skipped.")
            continue

        if role_id in seen_ids:
            duplicates.append(role_id)
        seen_ids.add(role_id)
        players.append(player)

    return {
        "server_id": meta["server_id"],
        "date_from": meta["date_from"],
        "date_to": meta["date_to"],
        "dataset_key": meta["dataset_key"],
        "source_file": source_filename or filepath.name,
        "column_map": {c["header"]: c["field"] for c in col_map.values()},
        "players": players,
        "player_count": len(players),
        "duplicate_role_ids": list(set(duplicates)),
        "warnings": warnings,
    }
