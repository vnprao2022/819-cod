"""Simple admin authentication."""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from functools import wraps
from pathlib import Path

from flask import jsonify, request

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config.json"
TOKEN_LIFETIME_SECONDS = 12 * 60 * 60


def load_config() -> dict:
    config = {"admin_username": "admin", "admin_password": "admin123"}
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            config.update(json.load(f))
    config["admin_username"] = os.environ.get("ADMIN_USERNAME", config["admin_username"])
    config["admin_password"] = os.environ.get("ADMIN_PASSWORD", config["admin_password"])
    return config


def _encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _decode(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def _signing_key() -> bytes:
    config = load_config()
    secret = os.environ.get("ADMIN_SESSION_SECRET")
    if not secret:
        secret = f"cod-stat:{config['admin_username']}:{config['admin_password']}"
    return hashlib.sha256(secret.encode("utf-8")).digest()


def login(username: str, password: str) -> str | None:
    config = load_config()
    valid_username = secrets.compare_digest(str(username), str(config["admin_username"]))
    valid_password = secrets.compare_digest(str(password), str(config["admin_password"]))
    if not (valid_username and valid_password):
        return None

    payload = {
        "username": config["admin_username"],
        "expires_at": int(time.time()) + TOKEN_LIFETIME_SECONDS,
        "nonce": secrets.token_hex(8),
    }
    encoded = _encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = _encode(hmac.new(_signing_key(), encoded.encode("ascii"), hashlib.sha256).digest())
    return f"{encoded}.{signature}"


def logout(token: str):
    # Tokens are stateless. The browser removes its copy on logout.
    return None


def is_valid_token(token: str | None) -> bool:
    if not token or "." not in token:
        return False
    try:
        encoded, signature = token.split(".", 1)
        expected = _encode(hmac.new(_signing_key(), encoded.encode("ascii"), hashlib.sha256).digest())
        if not secrets.compare_digest(signature, expected):
            return False
        payload = json.loads(_decode(encoded))
        config = load_config()
        return (
            payload.get("username") == config["admin_username"]
            and int(payload.get("expires_at", 0)) > int(time.time())
        )
    except (ValueError, TypeError, json.JSONDecodeError):
        return False


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
