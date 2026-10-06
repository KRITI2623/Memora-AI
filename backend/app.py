from __future__ import annotations

import mimetypes
import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator
from urllib.parse import urlsplit

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_DIR = BASE_DIR / "database"
UPLOADS_DIR = BASE_DIR / "uploads"
DATABASE_PATH = DATABASE_DIR / "memora.db"
FRONTEND_DIR = BASE_DIR / "frontend"
ALLOWED_RESOURCE_TYPES = {"pdf", "link", "note", "video", "image"}
DEFAULT_FOLDERS = ["Study_Notes", "Songs", "Travel", "Important_Docs"]
ALLOWED_FILE_EXTENSIONS = {
    "pdf": {".pdf"},
    "image": {".png", ".jpg", ".jpeg", ".gif", ".webp"},
    "video": {".mp4", ".mov", ".avi", ".mkv", ".webm"},
}

DATABASE_DIR.mkdir(exist_ok=True)
UPLOADS_DIR.mkdir(exist_ok=True)
for folder_name in ["pdfs", "videos", "images"]:
    (UPLOADS_DIR / folder_name).mkdir(exist_ok=True)

app = FastAPI(title="Memora AI", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
app.mount("/app", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
    except BaseException:
        connection.rollback()
        raise
    else:
        connection.commit()
    finally:
        connection.close()


def ensure_db() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS resources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                folder_id INTEGER NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('pdf', 'link', 'note', 'video', 'image')),
                title TEXT NOT NULL,
                content TEXT,
                url TEXT,
                file_name TEXT,
                file_path TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE CASCADE
            );
            """
        )


def ensure_default_folders() -> None:
    with get_connection() as connection:
        for folder_name in DEFAULT_FOLDERS:
            try:
                connection.execute("INSERT INTO folders (name) VALUES (?)", (folder_name,))
            except sqlite3.IntegrityError:
                continue


def serialize_folder(row: sqlite3.Row) -> dict[str, Any]:
    return {"id": row["id"], "name": row["name"], "created_at": row["created_at"]}


def serialize_resource(row: sqlite3.Row) -> dict[str, Any]:
    file_url = None
    if row["file_path"]:
        file_url = f"/uploads/{row['file_path']}"

    return {
        "id": row["id"],
        "folder_id": row["folder_id"],
        "type": row["type"],
        "title": row["title"],
        "content": row["content"],
        "url": row["url"],
        "file_name": row["file_name"],
        "file_path": row["file_path"],
        "file_url": file_url,
        "media_type": mimetypes.guess_type(row["file_name"] or "")[0],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def normalize_folder_name(raw_name: str) -> str:
    cleaned = (raw_name or "").strip()
    if not cleaned:
        raise ValueError("Folder name cannot be empty.")
    if len(cleaned) > 64:
        cleaned = cleaned[:64].strip()
    if not cleaned:
        raise ValueError("Folder name cannot be empty.")
    return cleaned


def validate_url(raw_url: str | None) -> str:
    if not raw_url:
        raise ValueError("A valid URL is required.")
    try:
        parsed = urlsplit(raw_url)
        port = parsed.port
    except ValueError as exc:
        raise ValueError("URL must be a valid HTTP/HTTPS link.") from exc
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or (port is not None and not 1 <= port <= 65535)
    ):
        raise ValueError("URL must be a valid HTTP/HTTPS link.")
    return raw_url


def folder_exists(connection: sqlite3.Connection, folder_id: int) -> sqlite3.Row | None:
    return connection.execute(
        "SELECT * FROM folders WHERE id = ?",
        (folder_id,),
    ).fetchone()


class FolderRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = normalize_folder_name(value)
        return cleaned


class FolderUpdateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = normalize_folder_name(value)
        return cleaned


class ResourceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str
    title: str | None = None
    content: str | None = None
    url: str | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        normalized = (value or "").strip().lower()
        if normalized not in ALLOWED_RESOURCE_TYPES:
            raise ValueError(f"Unsupported resource type: {value}")
        return normalized

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        return cleaned or None


    @model_validator(mode="after")
    def validate_resource_content(self) -> "ResourceRequest":
        if self.type == "note" and not (self.content and self.content.strip()):
            raise ValueError("Note content is required.")
        if self.type == "link":
            validate_url(self.url)
        return self


class NoteUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)

    @field_validator("title", "content")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field cannot be empty.")
        return cleaned


@app.on_event("startup")
def startup() -> None:
    ensure_db()
    ensure_default_folders()


@app.get("/", summary="Check that the API is running")
def home() -> dict[str, str]:
    return {"message": "Memora AI backend is running!"}


@app.get("/health", summary="Check API and database availability")
def health() -> dict[str, str]:
    with get_connection() as connection:
        connection.execute("SELECT 1")
    return {"status": "ok"}


@app.get(
    "/folders",
    summary="List folders",
    description="Returns every saved folder in display order.",
)
def get_folders() -> dict[str, list[dict[str, Any]]]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM folders ORDER BY id ASC"
        ).fetchall()
    return {"folders": [serialize_folder(row) for row in rows]}


@app.post(
    "/folders",
    summary="Create a folder",
    description="Folder names are trimmed and must be unique.",
    responses={409: {"description": "A folder with this name already exists."}},
)
def create_folder(folder: FolderRequest) -> dict[str, Any]:
    name = folder.name
    with get_connection() as connection:
        try:
            cursor = connection.execute(
                "INSERT INTO folders (name) VALUES (?)",
                (name,),
            )
            connection.commit()
        except sqlite3.IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Folder already exists.",
            ) from exc

        created = connection.execute(
            "SELECT * FROM folders WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()

    return {"message": "Folder created successfully.", "folder": serialize_folder(created)}


@app.put(
    "/folders/{folder_id}",
    summary="Rename a folder",
    responses={
        404: {"description": "Folder not found."},
        409: {"description": "A folder with the new name already exists."},
    },
)
def rename_folder(folder_id: int, folder: FolderUpdateRequest) -> dict[str, Any]:
    with get_connection() as connection:
        existing = folder_exists(connection, folder_id)
        if existing is None:
            raise HTTPException(status_code=404, detail="Folder not found.")

        try:
            connection.execute(
                "UPDATE folders SET name = ? WHERE id = ?",
                (folder.name, folder_id),
            )
            connection.commit()
        except sqlite3.IntegrityError as exc:
            raise HTTPException(
                status_code=409,
                detail="A folder with that name already exists.",
            ) from exc

        updated = connection.execute(
            "SELECT * FROM folders WHERE id = ?",
            (folder_id,),
        ).fetchone()

    return {"message": "Folder renamed successfully.", "folder": serialize_folder(updated)}


@app.delete(
    "/folders/{folder_id}",
    summary="Delete a folder and its resources",
    description="Also deletes uploaded files that belong to the folder.",
)
def delete_folder(folder_id: int) -> dict[str, str]:
    with get_connection() as connection:
        existing = folder_exists(connection, folder_id)
        if existing is None:
            raise HTTPException(status_code=404, detail="Folder not found.")

        resources = connection.execute(
            "SELECT * FROM resources WHERE folder_id = ?",
            (folder_id,),
        ).fetchall()
        for item in resources:
            if item["file_path"]:
                file_path = (UPLOADS_DIR / item["file_path"]).resolve()
                if file_path.exists():
                    file_path.unlink()

        connection.execute("DELETE FROM folders WHERE id = ?", (folder_id,))
        connection.commit()

    return {"message": "Folder and its resources deleted successfully."}


@app.get(
    "/folders/{folder_id}/resources",
    summary="List resources in a folder",
    description="Optionally filter by one resource type: pdf, link, note, video, or image.",
)
def get_folder_resources(folder_id: int, type: str | None = Query(default=None)) -> dict[str, list[dict[str, Any]]]:
    with get_connection() as connection:
        if folder_exists(connection, folder_id) is None:
            raise HTTPException(status_code=404, detail="Folder not found.")

        query = "SELECT * FROM resources WHERE folder_id = ?"
        params: list[Any] = [folder_id]
        if type:
            normalized_type = type.strip().lower()
            if normalized_type not in ALLOWED_RESOURCE_TYPES:
                raise HTTPException(status_code=400, detail="Unsupported resource type.")
            query += " AND type = ?"
            params.append(normalized_type)
        query += " ORDER BY created_at DESC"

        rows = connection.execute(query, tuple(params)).fetchall()

    return {"resources": [serialize_resource(row) for row in rows]}


@app.post(
    "/folders/{folder_id}/resources",
    summary="Create a note or link",
    description="Use this endpoint for notes and HTTP/HTTPS links. Upload files through the upload endpoint.",
)
def create_folder_resource(folder_id: int, resource: ResourceRequest) -> dict[str, Any]:
    with get_connection() as connection:
        if folder_exists(connection, folder_id) is None:
            raise HTTPException(status_code=404, detail="Folder not found.")

        resource_type = resource.type
        if resource_type == "link":
            try:
                validated_url = validate_url(resource.url)
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc
            title = resource.title or "Link"
            cursor = connection.execute(
                "INSERT INTO resources (folder_id, type, title, content, url) VALUES (?, ?, ?, ?, ?)",
                (folder_id, resource_type, title, resource.content, validated_url),
            )
        elif resource_type == "note":
            title = resource.title or "Untitled Note"
            cursor = connection.execute(
                "INSERT INTO resources (folder_id, type, title, content) VALUES (?, ?, ?, ?)",
                (folder_id, resource_type, title, resource.content),
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Resource type '{resource_type}' must use upload endpoint.",
            )

        connection.commit()
        created = connection.execute(
            "SELECT * FROM resources WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()

    return {"message": "Resource created successfully.", "resource": serialize_resource(created)}


@app.put(
    "/resources/{resource_id}",
    summary="Edit a note",
    description="Updates a saved note title and content.",
)
def update_note(resource_id: int, note: NoteUpdateRequest) -> dict[str, Any]:
    with get_connection() as connection:
        existing = connection.execute(
            "SELECT * FROM resources WHERE id = ?",
            (resource_id,),
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="Resource not found.")
        if existing["type"] != "note":
            raise HTTPException(status_code=400, detail="Only notes can be edited.")

        connection.execute(
            """
            UPDATE resources
            SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (note.title, note.content, resource_id),
        )
        connection.commit()
        updated = connection.execute(
            "SELECT * FROM resources WHERE id = ?",
            (resource_id,),
        ).fetchone()

    return {"message": "Note updated successfully.", "resource": serialize_resource(updated)}


@app.post(
    "/folders/{folder_id}/resources/upload",
    summary="Upload a PDF, image, or video",
    description="Accepts a file and its resource type; the file extension and contents are checked before storage.",
)
async def upload_folder_resource(
    folder_id: int,
    file: UploadFile = File(...),
    type: str = Form(...),
    title: str | None = Form(default=None),
) -> dict[str, Any]:
    normalized_type = (type or "").strip().lower()
    if normalized_type not in {"pdf", "image", "video"}:
        raise HTTPException(status_code=400, detail="Unsupported upload type.")

    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is required.")

    file_suffix = Path(file.filename).suffix.lower()
    allowed_extensions = ALLOWED_FILE_EXTENSIONS.get(normalized_type, set())
    if file_suffix not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type for {normalized_type}. Allowed extensions: {', '.join(sorted(allowed_extensions))}",
        )

    with get_connection() as connection:
        if folder_exists(connection, folder_id) is None:
            raise HTTPException(status_code=404, detail="Folder not found.")

    header = await file.read(32)
    await file.seek(0)
    valid_signatures = {
        "pdf": header.startswith(b"%PDF-"),
        "image": (
            header.startswith(b"\x89PNG\r\n\x1a\n")
            or header.startswith(b"\xff\xd8\xff")
            or header.startswith((b"GIF87a", b"GIF89a"))
            or (header.startswith(b"RIFF") and header[8:12] == b"WEBP")
        ),
        "video": (
            (file_suffix in {".mp4", ".mov"} and header[4:8] == b"ftyp")
            or (file_suffix in {".mkv", ".webm"} and header.startswith(b"\x1aE\xdf\xa3"))
            or (file_suffix == ".avi" and header.startswith(b"RIFF") and header[8:12] == b"AVI ")
        ),
    }
    if not valid_signatures[normalized_type]:
        raise HTTPException(status_code=400, detail="File contents do not match the selected file type.")

    safe_name = f"{uuid.uuid4().hex}{file_suffix}"
    if normalized_type == "pdf":
        destination_dir = UPLOADS_DIR / "pdfs"
        db_path = f"pdfs/{safe_name}"
    elif normalized_type == "video":
        destination_dir = UPLOADS_DIR / "videos"
        db_path = f"videos/{safe_name}"
    else:
        destination_dir = UPLOADS_DIR / "images"
        db_path = f"images/{safe_name}"

    destination_dir.mkdir(parents=True, exist_ok=True)
    destination_path = destination_dir / safe_name

    try:
        with destination_path.open("wb") as file_buffer:
            while True:
                chunk = await file.read(1024 * 64)
                if not chunk:
                    break
                file_buffer.write(chunk)
    except OSError:
        destination_path.unlink(missing_ok=True)
        raise

    resource_title = (title or file.filename).strip() or "Untitled"

    try:
        with get_connection() as connection:
            cursor = connection.execute(
                "INSERT INTO resources (folder_id, type, title, file_name, file_path) VALUES (?, ?, ?, ?, ?)",
                (folder_id, normalized_type, resource_title, file.filename, db_path),
            )
            created = connection.execute(
                "SELECT * FROM resources WHERE id = ?",
                (cursor.lastrowid,),
            ).fetchone()
    except sqlite3.Error:
        destination_path.unlink(missing_ok=True)
        raise

    return {"message": "File uploaded successfully.", "resource": serialize_resource(created)}


@app.delete("/resources/{resource_id}", summary="Delete a resource")
def delete_resource(resource_id: int) -> dict[str, str]:
    with get_connection() as connection:
        item = connection.execute(
            "SELECT * FROM resources WHERE id = ?",
            (resource_id,),
        ).fetchone()
        if item is None:
            raise HTTPException(status_code=404, detail="Resource not found.")

        if item["file_path"]:
            file_path = (UPLOADS_DIR / item["file_path"]).resolve()
            if file_path.exists():
                file_path.unlink()

        connection.execute("DELETE FROM resources WHERE id = ?", (resource_id,))
        connection.commit()

    return {"message": "Resource deleted successfully."}


@app.get(
    "/dashboard",
    summary="Get dashboard counts",
    description="Returns database-backed folder and resource totals.",
)
def get_dashboard() -> dict[str, dict[str, int]]:
    with get_connection() as connection:
        folder_count = connection.execute("SELECT COUNT(*) FROM folders").fetchone()[0]
        total_resources = connection.execute("SELECT COUNT(*) FROM resources").fetchone()[0]
        type_counts = {
            "pdfs": connection.execute("SELECT COUNT(*) FROM resources WHERE type = 'pdf'").fetchone()[0],
            "links": connection.execute("SELECT COUNT(*) FROM resources WHERE type = 'link'").fetchone()[0],
            "notes": connection.execute("SELECT COUNT(*) FROM resources WHERE type = 'note'").fetchone()[0],
            "videos": connection.execute("SELECT COUNT(*) FROM resources WHERE type = 'video'").fetchone()[0],
            "images": connection.execute("SELECT COUNT(*) FROM resources WHERE type = 'image'").fetchone()[0],
        }

    return {
        "summary": {
            "total_folders": folder_count,
            "total_resources": total_resources,
            **type_counts,
        }
    }


@app.get(
    "/search",
    summary="Search folders and resources",
    description="Searches folder names, titles, notes, links, and uploaded file names.",
)
def search_resources(q: str = Query(..., min_length=1)) -> dict[str, Any]:
    term = q.strip()
    if not term:
        raise HTTPException(status_code=422, detail="Enter a search term.")
    query = f"%{term}%"
    with get_connection() as connection:
        folder_rows = connection.execute(
            "SELECT * FROM folders WHERE LOWER(name) LIKE LOWER(?) ORDER BY id ASC",
            (query,),
        ).fetchall()
        resource_rows = connection.execute(
            """
            SELECT resources.*, folders.name AS folder_name
            FROM resources
            JOIN folders ON folders.id = resources.folder_id
            WHERE LOWER(resources.title) LIKE LOWER(?)
               OR LOWER(resources.content) LIKE LOWER(?)
               OR LOWER(resources.url) LIKE LOWER(?)
               OR LOWER(resources.file_name) LIKE LOWER(?)
               OR LOWER(folders.name) LIKE LOWER(?)
            ORDER BY resources.created_at DESC, resources.id DESC
            """,
            (query, query, query, query, query),
        ).fetchall()

    return {
        "folders": [serialize_folder(row) for row in folder_rows],
        "resources": [
            {**serialize_resource(row), "folder_name": row["folder_name"]}
            for row in resource_rows
        ],
    }


ensure_db()
ensure_default_folders()
