# Memora AI

Memora AI is a personal digital memory vault for organizing study resources, notes, links, PDFs, videos, and images in one place.

## Features

- Folder creation and management
- Search across folders and resources
- Notes and links with persistence
- PDF, video, and image upload support
- SQLite-backed persistence for folders and resources
- Backend file serving for uploaded media
- Clean dashboard with resource statistics

## Tech Stack

- FastAPI
- SQLite
- JavaScript + HTML + CSS
- Python

## Run the app

1. Open the project folder in VS Code.
2. In the VS Code PowerShell terminal, create a virtual environment if you do not already have one:

```powershell
py -m venv .venv
```

3. Install dependencies:

```bash
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

4. Start the backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

5. Open the app:

- http://127.0.0.1:8000/app/
- Interactive API documentation: http://127.0.0.1:8000/docs

## API overview

- GET /
- GET /folders
- POST /folders
- PUT /folders/{folder_id}
- DELETE /folders/{folder_id}
- GET /folders/{folder_id}/resources
- POST /folders/{folder_id}/resources
- POST /folders/{folder_id}/resources/upload
- PUT /resources/{resource_id} (edit a note)
- DELETE /resources/{resource_id}
- GET /dashboard
- GET /search

## Notes

- Uploaded files are stored under the uploads folder and served via FastAPI static files.
- Data persists across refreshes using SQLite.
- Default folders are created automatically if they do not already exist.
- The local SQLite database and uploaded files are intentionally excluded from Git.
- This is a local, single-user project; it does not include authentication or remote/cloud storage.

## Developer

Kriti Srivastava
