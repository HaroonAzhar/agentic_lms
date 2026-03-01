from sqlmodel import create_engine, Session, select
import os
from app.models import *

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://lms_user:lms_password@localhost:5435/lms_db")
engine = create_engine(DATABASE_URL)

with Session(engine) as session:
    comments = session.exec(select(GradeReviewComment)).all()
    print(f"Total Comments in DB: {len(comments)}")
