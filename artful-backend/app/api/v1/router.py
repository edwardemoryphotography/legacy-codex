from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def root():
    return {"message": "Legacy Codex API v1"}
