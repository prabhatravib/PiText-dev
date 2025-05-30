import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
import uvicorn

from src.pipeline import process_pipeline

load_dotenv()
app = FastAPI()  # <-- instantiate FastAPI

# 1) CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],     # make sure POST is allowed
    allow_headers=["*"],
)

# 2) Your API endpoints
class DescribeRequest(BaseModel):
    query: str

@app.post("/describe")
async def describe(request: DescribeRequest):
    if not request.query:
        raise HTTPException(status_code=400, detail="Query is required")
    try:
        result = await process_pipeline(request.query)
        return {"success": True, "query": request.query, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health", include_in_schema=False)
def health_check():
    return {"message": "LLM Diagram Service is running!"}

# 3) Serve static files (index.html, favicon.ico, assets…)
app.mount("/", StaticFiles(directory="public", html=True), name="static")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 3000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
