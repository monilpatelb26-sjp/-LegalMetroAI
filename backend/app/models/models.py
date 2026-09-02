from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    brand = Column(String, index=True)
    category = Column(String)
    
    # Relationships
    inspections = relationship("Inspection", back_populates="product")

class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True) # Nullable if product is not identified yet
    
    scan_date = Column(DateTime(timezone=True), server_default=func.now())
    location_gps = Column(String, nullable=True)
    inspector_id = Column(String, index=True) # Will link to users table later
    
    # Store S3/MinIO paths or local paths to evidence images
    image_paths = Column(JSON, nullable=True) 
    
    # OCR Extracted Raw Data (stored as JSON for flexibility)
    extracted_data = Column(JSON, nullable=True)
    
    # Compliance Status
    is_compliant = Column(Boolean, default=False)
    status_summary = Column(String) # e.g., "COMPLIANT", "NON_COMPLIANT", "NEEDS_REVIEW"
    
    # Detailed Validation Results from Rule Engine
    validation_results = Column(JSON, nullable=True)
    
    inspector_remarks = Column(Text, nullable=True)

    # Relationships
    product = relationship("Product", back_populates="inspections")

class CitizenComplaint(Base):
    __tablename__ = "citizen_complaints"

    id = Column(Integer, primary_key=True, index=True)
    shop_name = Column(String, index=True, nullable=True)
    shop_address = Column(String, nullable=True)
    contact_info = Column(String, nullable=True) # Anonymous or Phone/Email
    description = Column(Text, nullable=True)
    
    # Store evidence image path
    image_path = Column(String, nullable=False)
    
    status = Column(String, default="PENDING") # PENDING, REVIEWED, ACTION_TAKEN
    created_at = Column(DateTime(timezone=True), server_default=func.now())
