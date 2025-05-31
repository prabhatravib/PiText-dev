import os
import sys
from pathlib import Path

# Add the project root to Python path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
import uvicorn

from src.pipeline import process_pipeline
from src.llm import generate_deep_dive_response

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

class DeepDiveRequest(BaseModel):
    selected_text: str
    question: str
    original_query: str = ""  # Optional context from original query

@app.post("/describe")
async def describe(request: DescribeRequest):
    if not request.query:
        raise HTTPException(status_code=400, detail="Query is required")
    try:
        result = await process_pipeline(request.query)
        return {"success": True, "query": request.query, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/deep-dive")
async def deep_dive(request: DeepDiveRequest):
    if not request.selected_text or not request.question:
        raise HTTPException(status_code=400, detail="Selected text and question are required")
    try:
        response = await generate_deep_dive_response(
            selected_text=request.selected_text,
            question=request.question,
            original_query=request.original_query
        )
        return {"success": True, "response": response}
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