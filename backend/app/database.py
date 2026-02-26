from sqlmodel import create_engine, Session
from .models import * # Import models so SQLModel knows about them
import os

# Use environment variable for DB URL or default to local docker postgres
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://lms_user:lms_password@localhost:5435/lms_db")

engine = create_engine(DATABASE_URL, echo=True)

def get_session():
    with Session(engine) as session:
        yield session

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
