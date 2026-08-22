from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "Memora AI backend is running!"}


@app.get("/folders")
def get_folders():
    folders = ["Study_notes", "Songs", "Travel", "Important Docs"]
    return {"folders": folders}
