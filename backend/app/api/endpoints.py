from fastapi import APIRouter
from . import inspections
from . import chat

router = APIRouter()

router.include_router(inspections.router, prefix="/inspections", tags=["inspections"])
router.include_router(chat.router, prefix="/chat", tags=["chat"])

@router.get("/health")
def health_check():
    return {"status": "ok", "message": "LegalMetro AI backend is running!"}
