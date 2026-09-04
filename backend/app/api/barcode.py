from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from app.models.database import get_db
from app.models.models import Inspection

router = APIRouter()

class BarcodeData(BaseModel):
    brand_name: str
    net_quantity: str
    manufacturer: str
    barcode: str
    is_compliant: bool
    inspector_id: str
    image_url: str

@router.post("/barcode-save")
def save_barcode_inspection(data: BarcodeData, db: Session = Depends(get_db)):
    extracted = {
        "brand_name": data.brand_name,
        "mrp": "N/A (Barcode Scan)",
        "net_quantity": data.net_quantity,
        "mfg_date": "N/A",
        "manufacturer": data.manufacturer,
        "consumer_care": "N/A",
        "barcode": data.barcode
    }
    
    validation_results = {
        "violations": [] if data.is_compliant else ["Barcode product validation failed or unregistered."],
        "penalties": [],
        "total_fine": 0,
        "severity_score": 0 if data.is_compliant else 100,
        "risk_level": "None" if data.is_compliant else "Critical",
        "status_summary": "COMPLIANT" if data.is_compliant else "NON-COMPLIANT"
    }

    new_inspection = Inspection(
        image_paths=[data.image_url],
        status_summary=validation_results["status_summary"],
        is_compliant=data.is_compliant,
        extracted_data=extracted,
        validation_results=validation_results,
        scan_date=datetime.utcnow(),
        location_gps="Barcode Scanner",
        inspector_id=data.inspector_id
    )
    db.add(new_inspection)
    db.commit()
    db.refresh(new_inspection)
    
    return {
        "id": new_inspection.id,
        "is_compliant": new_inspection.is_compliant,
        "extracted_data": new_inspection.extracted_data,
        "validation_results": new_inspection.validation_results,
        "scan_date": new_inspection.scan_date.isoformat(),
        "inspector_id": new_inspection.inspector_id,
        "image_path": new_inspection.image_paths[0] if new_inspection.image_paths else ""
    }
