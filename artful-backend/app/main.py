from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import router as v1_router
from app.core.config import settings

app = FastAPI(
    title="Legacy Codex API",
    description="Backend API for Edward Emory Legacy Codex",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router.router, prefix="/api/v1", tags=["v1"])

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
