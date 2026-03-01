from sqlmodel import create_engine, Session, select
import os
from app.models import *

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://lms_user:lms_password@localhost:5435/lms_db")
engine = create_engine(DATABASE_URL)

with Session(engine) as session:
    ags = session.exec(select(AssignmentGrade)).all()
    for ag in ags:
        questions = session.exec(select(Question).where(Question.assignment_id == ag.assignment_id)).all()
        q_ids = [q.id for q in questions]
        all_resps = session.exec(select(QuestionResponse).where(QuestionResponse.question_id.in_(q_ids), QuestionResponse.student_id == ag.student_id)).all()
        total_marks = sum([r.marks for r in all_resps if r.marks is not None])
        ag.marks = total_marks
        session.add(ag)
        
    session.commit()
    print("Marks recalculated")
