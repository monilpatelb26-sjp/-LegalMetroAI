import os
import uuid
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from app.models.database import get_db
from app.models.models import CitizenComplaint
from datetime import datetime

router = APIRouter()
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/")
async def submit_complaint(
    shop_name: str = Form(None),
    shop_address: str = Form(None),
    contact_info: str = Form(None),
    description: str = Form(None),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        file_ext = image.filename.split(".")[-1]
        unique_filename = f"{uuid.uuid4()}.{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
            
        new_complaint = CitizenComplaint(
            shop_name=shop_name,
            shop_address=shop_address,
            contact_info=contact_info,
            description=description,
            image_path=f"api/v1/uploads/{unique_filename}",
        )
        
        db.add(new_complaint)
        db.commit()
        db.refresh(new_complaint)
        
        return {"success": True, "message": "Complaint submitted successfully", "id": new_complaint.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
def get_complaints(db: Session = Depends(get_db)):
    complaints = db.query(CitizenComplaint).order_by(CitizenComplaint.created_at.desc()).all()
    return complaints

@router.put("/{complaint_id}/status")
def update_complaint_status(complaint_id: int, status: str, db: Session = Depends(get_db)):
    complaint = db.query(CitizenComplaint).filter(CitizenComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    complaint.status = status
    db.commit()
    db.refresh(complaint)
    return complaint
