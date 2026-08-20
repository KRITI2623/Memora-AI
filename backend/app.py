from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def home():
    return {"message": "Memora AI backend is running!"}
