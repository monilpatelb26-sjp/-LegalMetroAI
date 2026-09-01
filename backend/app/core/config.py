import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "LegalMetro AI"
    API_V1_STR: str = "/api/v1"
    
    # Using PostgreSQL database (Reads from env variable first, falls back to local)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:monil2007@localhost/legalmetro")
    
    class Config:
        case_sensitive = True

settings = Settings()
