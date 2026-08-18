"""Persistent migrated-player storage for Vercel deployments."""

import asyncio
import json

from lib.blob_custom import enabled


def _pathname(server_id: str) -> str:
    return f"cod-stat/migrated/{server_id}.json"


async def _read(server_id: str) -> dict | None:
    from vercel.blob import AsyncBlobClient

    async with AsyncBlobClient() as client:
        try:
            result = await client.get(
                _pathname(server_id), access="private", use_cache=False
            )
        except TypeError:
            result = await client.get(_pathname(server_id), access="private")
        if result is None or result.status_code != 200 or result.content is None:
            return None
    return json.loads(result.content.decode("utf-8"))


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


def read_migrated(server_id: str) -> dict | None:
    if not enabled():
        return None
    try:
        return asyncio.run(_read(server_id))
    except Exception:
        return None


def write_migrated(server_id: str, data: dict) -> bool:
    if not enabled():
        return False
    try:
        asyncio.run(_write(server_id, data))
    except Exception as exc:
        raise RuntimeError("Could not save migrated players to Vercel Blob.") from exc
    return True
