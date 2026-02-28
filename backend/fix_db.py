from app.database import engine
from sqlmodel import Session, select
from app.models import Assignment, Question

with Session(engine) as session:
    assignment = session.get(Assignment, 1)
    if assignment:
        existing_questions = session.exec(select(Question).where(Question.assignment_id == 1)).all()
        if not existing_questions:
            print("Adding questions to Assignment 1...")
            questions = [
                "What is the main topic of this resource?",
                "What are two important key concepts?",
                "How do these concepts apply to modern AI?"
            ]
            for q in questions:
                session.add(Question(assignment_id=assignment.id, content=q))
            session.commit()
            print("Questions added successfully.")
        else:
            print("Questions already exist.")
