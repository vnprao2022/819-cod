"""Simple admin authentication."""

import hashlib
import json
import secrets
from functools import wraps
from pathlib import Path

from flask import jsonify, request

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config.json"
_active_tokens: set[str] = set()


def load_config() -> dict:
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"admin_password": "cod819"}


def login(password: str) -> str | None:
    config = load_config()
    if password == config.get("admin_password"):
        token = secrets.token_hex(32)
        _active_tokens.add(token)
        return token
    return None


def logout(token: str):
    _active_tokens.discard(token)


def is_valid_token(token: str | None) -> bool:
    return bool(token and token in _active_tokens)


def get_token_from_request() -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return request.headers.get("X-Admin-Token")


def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_request()
        if not is_valid_token(token):
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated
