"""JSON file data store."""

import json
from pathlib import Path

from lib.blob_custom import enabled as blob_enabled, is_vercel, read_custom, write_custom

BASE_DIR = Path(__file__).resolve().parent.parent
# Imported datasets and custom player information stay outside the web assets.
# Player pages are served through the Flask API, which reads this directory.
DATA_DIR = BASE_DIR / "data"
DATASETS_DIR = DATA_DIR / "datasets"
CUSTOM_DIR = DATA_DIR / "custom"


def _write_indexes():
    servers = list_servers()
    _write_json(DATA_DIR / "servers.json", servers)
    for server_id in servers:
        _write_json(DATASETS_DIR / server_id / "index.json", list_datasets(server_id))


def ensure_dirs():
    DATASETS_DIR.mkdir(parents=True, exist_ok=True)
    CUSTOM_DIR.mkdir(parents=True, exist_ok=True)


def _read_json(path: Path, default=None):
    if not path.exists():
        return default if default is not None else {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def list_servers() -> list[str]:
    ensure_dirs()
    servers = set()
    if DATASETS_DIR.exists():
        for d in DATASETS_DIR.iterdir():
            if d.is_dir():
                servers.add(d.name)
    if CUSTOM_DIR.exists():
        for f in CUSTOM_DIR.glob("*.json"):
            servers.add(f.stem)
    return sorted(servers, key=lambda x: int(x) if x.isdigit() else x)


def list_datasets(server_id: str) -> list[dict]:
    server_dir = DATASETS_DIR / server_id
    if not server_dir.exists():
        return []
    datasets = []
    for f in sorted(server_dir.glob("*.json")):
        if f.name == "index.json":
            continue
        data = _read_json(f)
        datasets.append({
            "key": f.stem,
            "date_from": data.get("date_from", ""),
            "date_to": data.get("date_to", ""),
            "source_file": data.get("source_file", f.name),
            "player_count": len(data.get("players", [])),
        })
    return datasets


def get_dataset(server_id: str, dataset_key: str) -> dict | None:
    path = DATASETS_DIR / server_id / f"{dataset_key}.json"
    return _read_json(path) if path.exists() else None


def dataset_exists(server_id: str, dataset_key: str) -> bool:
    return (DATASETS_DIR / server_id / f"{dataset_key}.json").exists()


def delete_dataset(server_id: str, dataset_key: str) -> bool:
    """Delete only an imported Excel dataset; custom JSON remains untouched."""
    path = DATASETS_DIR / server_id / f"{dataset_key}.json"
    if not path.exists():
        return False
    path.unlink()
    _write_indexes()
    return True


def save_dataset(dataset: dict) -> str:
    ensure_dirs()
    server_id = dataset["server_id"]
    key = dataset["dataset_key"]
    path = DATASETS_DIR / server_id / f"{key}.json"
    save_data = {
        "server_id": dataset["server_id"],
        "date_from": dataset["date_from"],
        "date_to": dataset["date_to"],
        "source_file": dataset["source_file"],
        "column_map": dataset.get("column_map", {}),
        "imported_at": dataset.get("imported_at"),
        "players": dataset["players"],
    }
    _write_json(path, save_data)
    _write_indexes()
    return str(path)


def get_custom(server_id: str) -> dict:
    remote = read_custom(server_id)
    if remote is not None:
        return remote
    path = CUSTOM_DIR / f"{server_id}.json"
    return _read_json(path, {})


def save_custom(server_id: str, data: dict):
    # Vercel Functions have a read-only deployment filesystem.  Never fall
    # back to data/custom here: that would become an opaque HTTP 500.
    if is_vercel():
        if not blob_enabled():
            raise RuntimeError(
                "Vercel Blob is not connected to this deployment. Redeploy the project after connecting the Blob store."
            )
        write_custom(server_id, data)
        return
    ensure_dirs()
    _write_json(CUSTOM_DIR / f"{server_id}.json", data)


def update_player_custom(server_id: str, role_id: str, fields: dict) -> dict:
    custom = get_custom(server_id)
    if role_id not in custom:
        custom[role_id] = {}
    custom[role_id].update(fields)
    save_custom(server_id, custom)
    return custom[role_id]


def get_player(server_id: str, role_id: str, dataset_key: str | None = None) -> dict | None:
    custom = get_custom(server_id)
    player_custom = custom.get(role_id, {})

    if dataset_key:
        dataset = get_dataset(server_id, dataset_key)
        if not dataset:
            return None
        for p in dataset.get("players", []):
            if str(p.get("role_id")) == str(role_id):
                return {**p, **player_custom, "_custom": player_custom}
        # The player may be absent from a newer dataset after migrating.
        for ds in reversed(list_datasets(server_id)):
            if ds["key"] == dataset_key:
                continue
            historical = get_dataset(server_id, ds["key"])
            for p in (historical or {}).get("players", []):
                if str(p.get("role_id")) == str(role_id):
                    return {**p, **player_custom, "_custom": player_custom, "migrated": True}
        return None

    datasets = list_datasets(server_id)
    if not datasets:
        return None
    latest = datasets[-1]["key"]
    return get_player(server_id, role_id, latest)


def get_dashboard_stats(server_id: str, dataset_key: str) -> dict:
    dataset = get_dataset(server_id, dataset_key)
    if not dataset:
        return {}
    players = dataset.get("players", [])
    if not players:
        return {"total_players": 0}

    powers = [p.get("power", 0) or 0 for p in players]
    ranked_powers = sorted(powers, reverse=True)
    power_buckets = {
        "power_0_20": sum(0 <= p < 20_000_000 for p in powers),
        "power_20_40": sum(20_000_000 <= p < 40_000_000 for p in powers),
        "power_40_60": sum(40_000_000 <= p < 60_000_000 for p in powers),
        "power_60_80": sum(60_000_000 <= p < 80_000_000 for p in powers),
        "power_80_100": sum(80_000_000 <= p < 100_000_000 for p in powers),
        "power_over_100": sum(p >= 100_000_000 for p in powers),
    }
    return {
        "total_players": len(players),
        "total_power": sum(powers),
        "top_300_power": sum(ranked_powers[:300]),
        "top_200_power": sum(ranked_powers[:200]),
        "power_buckets": power_buckets,
        "average_power": round(sum(powers) / len(powers)) if powers else 0,
        "highest_power": max(powers) if powers else 0,
        "total_deaths": sum(p.get("deaths", 0) or 0 for p in players),
        "total_merit": sum(p.get("merit", 0) or 0 for p in players),
        "total_healing": sum(p.get("healing", 0) or 0 for p in players),
        "total_gathering": sum(p.get("gathering", 0) or 0 for p in players),
        "total_alliance_donation": sum(p.get("alliance_donation", 0) or 0 for p in players),
        "total_behemoth_wins": sum(p.get("behemoth_wins", 0) or 0 for p in players),
    }
