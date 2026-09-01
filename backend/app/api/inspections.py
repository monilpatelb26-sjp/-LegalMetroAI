import os
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.database import get_db
from app.models.models import Inspection

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException

@router.post("/upload")
async def upload_inspection_image(
    file: UploadFile = File(...),
    latitude: str = Form(None),
    longitude: str = Form(None),
    inspector_id: str = Form("INSP-001"), # Mock default for demo
    db: Session = Depends(get_db)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Generate unique filename to prevent overwriting
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save file to disk
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
        
    # Phase 2: Run OCR & Rule Engine pipeline
    from app.services.ocr_service import process_inspection_image
    from app.services.rule_engine import validate_declarations
    
    extracted_data = process_inspection_image(file_path)
    validation_results = validate_declarations(extracted_data)
        
    location_gps = f"{latitude}, {longitude}" if latitude and longitude else "GPS Not Available"

    # Create DB Record for Inspection
    new_inspection = Inspection(
        image_paths=[file_path],
        status_summary=validation_results["status_summary"],
        is_compliant=validation_results["is_compliant"],
        extracted_data=extracted_data,
        validation_results=validation_results,
        scan_date=datetime.utcnow(),
        location_gps=location_gps,
        inspector_id=inspector_id
    )
    
    db.add(new_inspection)
    db.commit()
    db.refresh(new_inspection)
    
    return {
        "message": "Image uploaded and processed successfully",
        "inspection_id": new_inspection.id,
        "is_compliant": new_inspection.is_compliant,
        "violations": validation_results["violations"],
        "extracted_data": extracted_data
    }



@router.get("/")
def get_all_inspections(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    inspections = db.query(Inspection).order_by(Inspection.scan_date.desc()).offset(skip).limit(limit).all()
    return inspections

@router.get("/{inspection_id}")
def get_inspection(inspection_id: int, db: Session = Depends(get_db)):
    inspection = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return inspection

@router.delete("/{inspection_id}")
def delete_inspection(inspection_id: int, db: Session = Depends(get_db)):
    inspection = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    db.delete(inspection)
    db.commit()
    return {"message": "Inspection deleted successfully"}
