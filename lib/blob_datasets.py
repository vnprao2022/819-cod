"""Persistent dataset JSON storage for Vercel deployments."""

import asyncio
import json

from lib.blob_custom import enabled


def _dataset_path(server_id: str, dataset_key: str) -> str:
    return f"cod-stat/datasets/{server_id}/{dataset_key}.json"


def _index_path(server_id: str) -> str:
    return f"cod-stat/datasets/{server_id}/index.json"


async def _read_json(pathname: str) -> dict | None:
    from vercel.blob import AsyncBlobClient

    async with AsyncBlobClient() as client:
        try:
            result = await client.get(pathname, access="private", use_cache=False)
        except TypeError:
            result = await client.get(pathname, access="private")
        if result is None or result.status_code != 200 or result.content is None:
            return None
    return json.loads(result.content.decode("utf-8"))


async def _write_json(pathname: str, data: dict) -> None:
    from vercel.blob import AsyncBlobClient

    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    async with AsyncBlobClient() as client:
        await client.put(
            pathname,
            payload,
            access="private",
            content_type="application/json",
            overwrite=True,
            cache_control_max_age=0,
        )


async def _delete(pathname: str) -> None:
    from vercel.blob import AsyncBlobClient

    async with AsyncBlobClient() as client:
        await client.delete(pathname)


def read_dataset(server_id: str, dataset_key: str) -> dict | None:
    if not enabled():
        return None
    try:
        return asyncio.run(_read_json(_dataset_path(server_id, dataset_key)))
    except Exception:
        return None


def write_dataset(server_id: str, dataset_key: str, data: dict) -> str:
    if not enabled():
        raise RuntimeError("Vercel Blob is not connected to this deployment.")
    try:
        pathname = _dataset_path(server_id, dataset_key)
        asyncio.run(_write_json(pathname, data))
        return pathname
    except Exception as exc:
        raise RuntimeError("Could not save dataset to Vercel Blob.") from exc


def delete_dataset(server_id: str, dataset_key: str) -> None:
    if not enabled():
        raise RuntimeError("Vercel Blob is not connected to this deployment.")
    try:
        asyncio.run(_delete(_dataset_path(server_id, dataset_key)))
    except Exception:
        # A dataset bundled with the deployment has no corresponding Blob.
        # The index tombstone still hides it after deletion.
        return


def read_index(server_id: str) -> dict | None:
    if not enabled():
        return None
    try:
        return asyncio.run(_read_json(_index_path(server_id)))
    except Exception:
        return None


def write_index(server_id: str, data: dict) -> None:
    if not enabled():
        raise RuntimeError("Vercel Blob is not connected to this deployment.")
    try:
        asyncio.run(_write_json(_index_path(server_id), data))
    except Exception as exc:
        raise RuntimeError("Could not update the dataset index in Vercel Blob.") from exc
