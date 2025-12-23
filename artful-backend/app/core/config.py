from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8080",
    ]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
