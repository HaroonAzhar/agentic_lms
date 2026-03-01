from sqlmodel import create_engine, Session, select
import os
from app.models import *

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://lms_user:lms_password@localhost:5435/lms_db")
engine = create_engine(DATABASE_URL)

with Session(engine) as session:
    # Cleanup QuestionResponse
    qrs = session.exec(select(QuestionResponse)).all()
    seen_qr = set()
    for qr in qrs:
        key = (qr.student_id, qr.question_id)
        if key in seen_qr:
            # Delete associated comments and topic scores first to avoid constraint violation
            comments = session.exec(select(GradeReviewComment).where(GradeReviewComment.response_id == qr.id)).all()
            for c in comments: session.delete(c)
            topic_scores = session.exec(select(TopicScore).where(TopicScore.response_id == qr.id)).all()
            for ts in topic_scores: session.delete(ts)
            session.delete(qr)
        else:
            seen_qr.add(key)
            
    # Cleanup AssignmentGrade
    ags = session.exec(select(AssignmentGrade)).all()
    seen_ag = set()
    for ag in ags:
        key = (ag.student_id, ag.assignment_id)
        if key in seen_ag:
            session.delete(ag)
        else:
            seen_ag.add(key)
            
    session.commit()
    print("Database deduplication complete.")
