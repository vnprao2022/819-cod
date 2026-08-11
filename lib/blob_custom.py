"""Persistent custom-player storage for Vercel deployments.

Imported Excel snapshots always live in ``data/``.  When the app runs on
Vercel, custom values are kept in the project's private Blob store because a
Vercel Function cannot persist writes to its local filesystem.
"""

import asyncio
import json
import os


def is_vercel() -> bool:
    """Return whether the code is running inside a Vercel deployment."""
    # BLOB_STORE_ID is injected whenever this project is connected to Blob.
    # It is the most reliable signal for Python functions across Vercel runtimes.
    return bool(
        os.environ.get("VERCEL")
        or os.environ.get("VERCEL_ENV")
        or os.environ.get("BLOB_STORE_ID")
    )


def enabled() -> bool:
    """Return whether this request can use the connected Vercel Blob store."""
    return bool(is_vercel() and os.environ.get("BLOB_READ_WRITE_TOKEN"))


def _pathname(server_id: str) -> str:
    return f"cod-stat/custom/{server_id}.json"


async def _read(server_id: str) -> dict | None:
    from vercel.blob import AsyncBlobClient

    async with AsyncBlobClient() as client:
        # Read the just-saved value instead of a CDN-cached copy.  Older SDK
        # releases do not support use_cache, so retain a compatible fallback.
        try:
            result = await client.get(
                _pathname(server_id), access="private", use_cache=False
            )
        except TypeError:
            result = await client.get(_pathname(server_id), access="private")
        if result is None or result.status_code != 200 or result.stream is None:
            return None
        content = b"".join([chunk async for chunk in result.stream])
    return json.loads(content.decode("utf-8"))


async def _write(server_id: str, data: dict) -> None:
    from vercel.blob import AsyncBlobClient

    payload = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
    async with AsyncBlobClient() as client:
        await client.put(
            _pathname(server_id),
            payload,
            access="private",
            content_type="application/json",
            overwrite=True,
            cache_control_max_age=0,
        )


def read_custom(server_id: str) -> dict | None:
    """Read custom data from Blob; ``None`` means there is no remote copy yet."""
    if not enabled():
        return None
    try:
        return asyncio.run(_read(server_id))
    except Exception:
        # A missing remote file should fall back to the version committed in data/.
        return None


def write_custom(server_id: str, data: dict) -> bool:
    """Write custom data to Blob and return whether Blob storage was used."""
    if not enabled():
        return False
    try:
        asyncio.run(_write(server_id, data))
    except Exception as exc:
        raise RuntimeError("Could not save custom data to Vercel Blob.") from exc
    return True
