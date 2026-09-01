from fastapi import APIRouter, Depends
from pydantic import BaseModel
import google.generativeai as genai
from sqlalchemy.orm import Session
from app.models.database import get_db
from app.models.models import Inspection

import os

router = APIRouter()

# Using the API key from environment variable
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    response: str

@router.post("/", response_model=ChatResponse)
async def chat_with_legal_assistant(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        # Fetch operational data from the database
        total_inspections = db.query(Inspection).count()
        compliant_count = db.query(Inspection).filter(Inspection.is_compliant == True).count()
        non_compliant_count = db.query(Inspection).filter(Inspection.is_compliant == False).count()
        
        # Get some recent violations for context
        recent_violations = db.query(Inspection).filter(Inspection.is_compliant == False).order_by(Inspection.scan_date.desc()).limit(5).all()
        violations_summary = []
        for v in recent_violations:
            try:
                mfg = v.extracted_data.get('manufacturer', 'Unknown')
                violations_summary.append(f"Manufacturer: {mfg}")
            except:
                pass
                
        violation_context = ", ".join(violations_summary) if violations_summary else "None recently."
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        system_prompt = f"""
        You are 'LegalMetro Assistant', an expert AI Chatbot for the Indian Legal Metrology Department.
        You assist Field Inspectors and Department Heads with queries related to the Legal Metrology Act, 2009 and the Legal Metrology (Packaged Commodities) Rules, 2011.
        
        You also have access to the LIVE DATABASE of the current dashboard. 
        Here is the current live data you MUST use if asked about operational statistics:
        - Total Products Scanned/Inspected: {total_inspections}
        - Compliant (Passed) Products: {compliant_count}
        - Non-Compliant (Violations/Failed): {non_compliant_count}
        - Recent Repeat Offenders/Violators found: {violation_context}
        
        Guidelines:
        1. Keep answers concise, accurate, and professional.
        2. Cite specific Sections or Rules when applicable (e.g., Section 36 of the Act, Rule 6 of the PCR).
        3. If asked about penalties, provide the exact fine amount or imprisonment term as per the Act.
        4. If asked about "how many products are compliant", "how many scans today", or any operational data, USE THE LIVE DATABASE STATS provided above. DO NOT say you don't have access.
        5. If the query is completely unrelated to Legal Metrology or the dashboard data, politely decline to answer.
        6. Use simple markdown formatting (bullet points, bold text) for readability.
        """
        
        full_prompt = system_prompt + "\n\nUser Query: " + request.query
        response = model.generate_content(full_prompt)
        
        return ChatResponse(response=response.text)
    except Exception as e:
        return ChatResponse(response=f"Error processing query: {str(e)}")
