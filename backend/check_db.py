from sqlmodel import create_engine, Session, select
import os
from app.models import *

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://lms_user:lms_password@localhost:5435/lms_db")
engine = create_engine(DATABASE_URL)

with Session(engine) as session:
    print("AssignmentGrade counts:")
    ags = session.exec(select(AssignmentGrade)).all()
    ag_dict = {}
    for ag in ags:
        key = (ag.student_id, ag.assignment_id)
        ag_dict[key] = ag_dict.get(key, 0) + 1
    print([k for k, v in ag_dict.items() if v > 1])
    
    print("QuestionResponse counts:")
    qrs = session.exec(select(QuestionResponse)).all()
    qr_dict = {}
    for qr in qrs:
        key = (qr.student_id, qr.question_id)
        qr_dict[key] = qr_dict.get(key, 0) + 1
    print([k for k, v in qr_dict.items() if v > 1])
