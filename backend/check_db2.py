from sqlmodel import create_engine, Session, select
import os
from app.models import *

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://lms_user:lms_password@localhost:5435/lms_db")
engine = create_engine(DATABASE_URL)

with Session(engine) as session:
    print("AssignmentGrade sums:")
    ags = session.exec(select(AssignmentGrade)).all()
    for ag in ags:
        print(f"UID: {ag.student_id}, AID: {ag.assignment_id}, SUM: {ag.marks}")
        
    print("\nQuestionResponse marks:")
    qrs = session.exec(select(QuestionResponse)).all()
    for qr in qrs:
        print(f"UID: {qr.student_id}, QID: {qr.question_id}, MARKS: {qr.marks}")
