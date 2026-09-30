"""Call of Dragons Stats - Flask API Server"""

import os
import re
import tempfile
from datetime import datetime, timezone

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from lib.data_store import (
    dataset_exists,
    delete_dataset,
    get_custom,
    get_dashboard_stats,
    get_dataset,
    get_honors,
    get_migration_candidates,
    get_migrated_players,
    get_player,
    get_site_settings,
    list_datasets,
    list_servers,
    save_custom,
    save_dataset,
    update_player_custom,
    update_site_settings,
)
from lib.auth import login, logout, require_admin, is_valid_token, get_token_from_request
from lib.excel_parser import parse_filename, read_excel

app = Flask(__name__, static_folder="public", static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 4 * 1024 * 1024
CORS(app)


@app.errorhandler(413)
def file_too_large(_error):
    return jsonify({"error": "Excel file is too large. The maximum upload size is 4 MB."}), 413


# ── Static pages ──────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory("public", "index.html")


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory("public", path)


# ── API: Servers ──────────────────────────────────────────────

@app.route("/api/servers")
def api_servers():
    return jsonify(list_servers())


# ── API: Datasets ─────────────────────────────────────────────

@app.route("/api/servers/<server_id>/datasets")
def api_datasets(server_id):
    return jsonify(list_datasets(server_id))


@app.route("/api/servers/<server_id>/dataset/<dataset_key>")
def api_dataset(server_id, dataset_key):
    dataset = get_dataset(server_id, dataset_key)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404
    custom = get_custom(server_id)
    datasets = list_datasets(server_id)
    latest_key = datasets[-1]["key"] if datasets else dataset_key
    migrated_players = get_migrated_players(server_id)
    migrated_ids = {str(p.get("role_id", "")) for p in migrated_players}
    merged = []
    included_ids = set()
    for p in dataset.get("players", []):
        rid = str(p.get("role_id", ""))
        included_ids.add(rid)
        merged.append({**p, **custom.get(rid, {}), "migrated": rid in migrated_ids})
    # The latest ranking includes durable snapshots from the migrated store.
    if dataset_key == latest_key:
        for p in migrated_players:
            rid = str(p.get("role_id", ""))
            if rid and rid not in included_ids:
                included_ids.add(rid)
                merged.append({**p, **custom.get(rid, {}), "migrated": True})
    return jsonify({**dataset, "players": merged})


@app.route("/api/servers/<server_id>/dataset/<dataset_key>", methods=["DELETE"])
@require_admin
def api_delete_dataset(server_id, dataset_key):
    if not re.fullmatch(r"\d+", server_id) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}", dataset_key):
        return jsonify({"error": "Invalid dataset key"}), 400
    try:
        deleted = delete_dataset(server_id, dataset_key)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    if not deleted:
        return jsonify({"error": "Dataset not found"}), 404
    return jsonify({"success": True, "custom_preserved": True})


@app.route("/api/servers/<server_id>/dashboard/<dataset_key>")
def api_dashboard(server_id, dataset_key):
    dataset = get_dataset(server_id, dataset_key)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404
    stats = get_dashboard_stats(server_id, dataset_key)
    settings = get_site_settings(server_id)
    return jsonify({
        "server_id": server_id,
        "date_from": dataset["date_from"],
        "date_to": dataset["date_to"],
        "stats": stats,
        "honors_visible": settings["honors_visible"],
        "honors": get_honors(server_id, dataset_key) if settings["honors_visible"] else [],
    })


# ── API: Players ──────────────────────────────────────────────

@app.route("/api/servers/<server_id>/player/<role_id>")
def api_player(server_id, role_id):
    dataset_key = request.args.get("dataset")
    player = get_player(server_id, role_id, dataset_key)
    if not player:
        return jsonify({"error": "Player not found"}), 404
    return jsonify(player)


# ── API: Custom data ──────────────────────────────────────────

@app.route("/api/servers/<server_id>/custom")
def api_custom(server_id):
    return jsonify({
        key: value for key, value in get_custom(server_id).items()
        if not key.startswith("__")
    })


@app.route("/api/servers/<server_id>/settings")
def api_settings(server_id):
    return jsonify(get_site_settings(server_id))


@app.route("/api/servers/<server_id>/settings", methods=["PUT"])
@require_admin
def api_update_settings(server_id):
    data = request.get_json() or {}
    allowed = {"migration_page_visible", "honors_visible", "migration_deadline"}
    filtered = {key: value for key, value in data.items() if key in allowed}
    if not filtered:
        return jsonify({"error": "No valid settings provided"}), 400
    bool_values = [value for key, value in filtered.items() if key != "migration_deadline"]
    if any(not isinstance(value, bool) for value in bool_values):
        return jsonify({"error": "Settings values must be boolean"}), 400
    if "migration_deadline" in filtered:
        filtered["migration_deadline"] = str(filtered["migration_deadline"] or "").strip()
        if filtered["migration_deadline"]:
            try:
                datetime.strptime(filtered["migration_deadline"], "%Y-%m-%d")
            except ValueError:
                return jsonify({"error": "Migration deadline must use YYYY-MM-DD."}), 400
    try:
        return jsonify(update_site_settings(server_id, filtered))
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503


@app.route("/api/servers/<server_id>/migration")
def api_migration(server_id):
    return jsonify(get_migration_candidates(server_id))


@app.route("/api/admin/servers/<server_id>/migration")
@require_admin
def api_admin_migration(server_id):
    return jsonify(get_migration_candidates(server_id, include_hidden=True))


@app.route("/api/servers/<server_id>/custom/<role_id>", methods=["PUT"])
@require_admin
def api_update_custom(server_id, role_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    allowed = {
        "deco", "red_artifact", "main", "tier", "note", "team", "status", "farm_role_ids",
        "migration_required", "migration_reason",
    }
    filtered = {k: v for k, v in data.items() if k in allowed}
    if "status" in filtered and filtered["status"] not in {"active", "migrated", "quit", "rest_ticket"}:
        return jsonify({"error": "Invalid player status"}), 400
    if "migration_required" in filtered:
        if not isinstance(filtered["migration_required"], bool):
            return jsonify({"error": "migration_required must be boolean"}), 400
        if filtered["migration_required"]:
            filtered["migration_reason"] = str(filtered.get("migration_reason", "")).strip()
            if not filtered["migration_reason"]:
                return jsonify({"error": "Migration reason is required."}), 400
            filtered["migration_reason"] = filtered["migration_reason"][:500]
            # Remove values from the previous per-player destination/deadline model.
            filtered["migration_target"] = ""
            filtered["migration_deadline"] = ""
        else:
            filtered.update({
                "migration_reason": "",
                "migration_target": "",
                "migration_deadline": "",
            })
    try:
        result = update_player_custom(server_id, role_id, filtered)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    return jsonify(result)


# ── API: Admin ────────────────────────────────────────────────

@app.route("/api/admin/login", methods=["POST"])
def api_admin_login():
    data = request.get_json() or {}
    username = data.get("username", "")
    password = data.get("password", "")
    token = login(username, password)
    if not token:
        return jsonify({"error": "Invalid username or password"}), 401
    return jsonify({"token": token})


@app.route("/api/admin/logout", methods=["POST"])
def api_admin_logout():
    token = get_token_from_request()
    if token:
        logout(token)
    return jsonify({"success": True})


@app.route("/api/admin/check")
def api_admin_check():
    token = get_token_from_request()
    return jsonify({"admin": is_valid_token(token)})


# ── API: Import ───────────────────────────────────────────────

@app.route("/api/import/preview", methods=["POST"])
@require_admin
def api_import_preview():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    meta = parse_filename(file.filename)
    if not meta:
        return jsonify({
            "error": "Invalid filename.",
            "hint": "Required format: SERVER_STARTDATE_ENDDATE.xlsx",
        }), 400

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        file.save(tmp.name)
        tmp_path = tmp.name

    try:
        parsed = read_excel(tmp_path, file.filename)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    finally:
        os.unlink(tmp_path)

    exists = dataset_exists(meta["server_id"], meta["dataset_key"])

    return jsonify({
        "filename": file.filename,
        "server_id": parsed["server_id"],
        "date_from": parsed["date_from"],
        "date_to": parsed["date_to"],
        "dataset_key": parsed["dataset_key"],
        "player_count": parsed["player_count"],
        "duplicate_role_ids": parsed["duplicate_role_ids"],
        "warnings": parsed["warnings"],
        "column_map": parsed["column_map"],
        "dataset_exists": exists,
        "preview_players": parsed["players"][:5],
    })


@app.route("/api/import/confirm", methods=["POST"])
@require_admin
def api_import_confirm():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    meta = parse_filename(file.filename)
    if not meta:
        return jsonify({"error": "Invalid filename."}), 400

    if dataset_exists(meta["server_id"], meta["dataset_key"]):
        overwrite = request.form.get("overwrite") == "true"
        if not overwrite:
            return jsonify({
                "error": "Dataset already exists.",
                "dataset_key": meta["dataset_key"],
            }), 409

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        file.save(tmp.name)
        tmp_path = tmp.name

    try:
        parsed = read_excel(tmp_path, file.filename)
        parsed["imported_at"] = datetime.now(timezone.utc).isoformat()
        path = save_dataset(parsed)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 503
    finally:
        os.unlink(tmp_path)

    return jsonify({
        "success": True,
        "path": path,
        "server_id": parsed["server_id"],
        "dataset_key": parsed["dataset_key"],
        "player_count": parsed["player_count"],
    })


if __name__ == "__main__":
    from lib.data_store import ensure_dirs
    ensure_dirs()
    print("Call of Dragons Stats running at http://localhost:5000")
    app.run(debug=True, port=5000)
