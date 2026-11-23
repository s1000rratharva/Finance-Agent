"""Secure document storage on S3-compatible object stores.

Local dev -> MinIO, production -> Cloudflare R2 (S3 API). Documents are stored
under ``/{workspace_id}/{document_id}/{filename}`` so a leaked key alone never
crosses a tenant boundary.
"""

from __future__ import annotations

import mimetypes
import uuid
from functools import lru_cache
from pathlib import Path
from typing import BinaryIO

from app.core.config import settings
from app.core.exceptions import AppError, ServiceUnavailableError
from app.core.logging import get_logger

log = get_logger("storage")


class ObjectStore:
    def __init__(self) -> None:
        self._client = None

    @property
    def client(self):
        if self._client is None:
            try:
                import boto3
            except ImportError as exc:  # pragma: no cover
                raise ServiceUnavailableError("boto3 is not installed") from exc
            self._client = boto3.client(
                "s3",
                endpoint_url=settings.s3_endpoint_url or None,
                aws_access_key_id=settings.s3_access_key or None,
                aws_secret_access_key=settings.s3_secret_key or None,
                region_name=settings.s3_region,
            )
        return self._client

    @staticmethod
    def build_key(workspace_id: str, document_id: str, filename: str) -> str:
        safe_name = Path(filename).name.replace(" ", "_")
        return f"{workspace_id}/{document_id}/{safe_name}"

    def ensure_bucket(self) -> None:
        try:
            self.client.head_bucket(Bucket=settings.s3_bucket)
        except Exception:
            try:
                self.client.create_bucket(Bucket=settings.s3_bucket)
                log.info("storage.bucket_created", bucket=settings.s3_bucket)
            except Exception as exc:
                log.warning("storage.bucket_create_failed", error=str(exc))

    async def upload_file(
        self,
        key: str,
        fileobj: BinaryIO | Path | bytes,
        *,
        content_type: str | None = None,
    ) -> str:
        import asyncio

        def _run() -> str:
            extra = {}
            if content_type:
                extra["ContentType"] = content_type
            elif isinstance(fileobj, Path):
                extra["ContentType"] = (
                    mimetypes.guess_type(fileobj.name)[0] or "application/octet-stream"
                )
            if isinstance(fileobj, bytes):
                # `upload_fileobj` requires a file-like object; raw bytes go via put_object.
                self.client.put_object(
                    Bucket=settings.s3_bucket, Key=key, Body=fileobj, **extra
                )
            elif isinstance(fileobj, Path):
                self.client.upload_file(str(fileobj), settings.s3_bucket, key, ExtraArgs=extra)
            else:
                self.client.upload_fileobj(
                    fileobj, settings.s3_bucket, key, ExtraArgs=extra
                )
            return key

        try:
            return await asyncio.to_thread(_run)
        except Exception as exc:
            # Fall back to local disk so ingestion keeps working without MinIO.
            log.warning("storage.s3_unavailable", error=str(exc))
            return await self._upload_local(key, fileobj)

    async def _upload_local(self, key: str, fileobj: BinaryIO | Path | bytes) -> str:
        target = settings.upload_dir / key
        target.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(fileobj, bytes):
            target.write_bytes(fileobj)
        elif isinstance(fileobj, Path):
            target.write_bytes(fileobj.read_bytes())
        else:
            target.write_bytes(fileobj.read())
        log.info("storage.local_write", path=str(target))
        return key

    async def download_to(self, key: str, destination: Path) -> Path:
        import asyncio

        def _run() -> None:
            destination.parent.mkdir(parents=True, exist_ok=True)
            self.client.download_file(settings.s3_bucket, key, str(destination))

        try:
            await asyncio.to_thread(_run)
        except Exception as exc:
            local = settings.upload_dir / key
            if not local.exists():
                raise AppError(f"Object not found: {key}", code="object_missing") from exc
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(local.read_bytes())
        return destination

    async def delete(self, key: str) -> None:
        import asyncio

        def _run() -> None:
            try:
                self.client.delete_object(Bucket=settings.s3_bucket, Key=key)
            except Exception as exc:
                log.warning("storage.delete_failed", key=key, error=str(exc))

        await asyncio.to_thread(_run)


@lru_cache
def get_object_store() -> ObjectStore:
    return ObjectStore()


def new_document_id() -> str:
    return str(uuid.uuid4())
