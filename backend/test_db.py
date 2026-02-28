from app.database import engine
from sqlmodel import Session, select
from app.models import Assignment, Question

with Session(engine) as session:
    assignments = session.exec(select(Assignment)).all()
    for a in assignments:
        questions = session.exec(select(Question).where(Question.assignment_id == a.id)).all()
        print(f"Assignment {a.id}: {a.title}, Questions: {len(questions)}")
        for q in questions:
            print(f"  - Q{q.id}: {q.content}")
