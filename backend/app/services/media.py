"""Validates and reads an uploaded image/video for storage as a DB blob.

Images/video go into Postgres itself (media_data columns on Recipe/User)
rather than local disk — the DB is already durable and reachable from any
device/network (hosted on Neon), whereas the backend's local filesystem is
not: it doesn't survive a redeploy or restart on most hosts, and isn't
shared across multiple server instances.
"""

import os

from fastapi import HTTPException, UploadFile

ALLOWED_MEDIA_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm"}
_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
}


async def read_validated_media(media: UploadFile) -> tuple[bytes, str]:
    """Returns (raw bytes, content type) or raises 400 on a disallowed extension."""
    ext = os.path.splitext(media.filename or "")[1].lower()
    if ext not in ALLOWED_MEDIA_EXT:
        raise HTTPException(400, "Error: Invalid image/video format")
    return await media.read(), _CONTENT_TYPES[ext]
