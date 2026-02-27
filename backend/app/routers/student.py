from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy import func
from typing import List, Annotated

from ..database import get_session
from ..models import User, UserRole, Class, Resource, Assignment, Score, ClassEnrollment
from ..auth import get_current_user

router = APIRouter(
    prefix="/student",
    tags=["student"],
    responses={404: {"description": "Not found"}},
)

def check_student_role(user: User):
    if user.role != UserRole.STUDENT and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")

@router.get("/classes", response_model=List[Class])
async def list_enrolled_classes(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_student_role(current_user)
    # Join on ClassEnrollment
    statement = select(Class).join(ClassEnrollment).where(ClassEnrollment.student_id == current_user.id)
    return session.exec(statement).all()

@router.get("/classes/{class_id}/resources", response_model=List[Resource])
async def list_resources(
    class_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_student_role(current_user)
    # Verify enrollment? (Skip for now)
    statement = select(Resource).where(Resource.class_id == class_id)
    return session.exec(statement).all()

@router.get("/classes/{class_id}/assignments", response_model=List[Assignment])
async def list_assignments(
    class_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_student_role(current_user)
    statement = select(Assignment).where(Assignment.class_id == class_id)
    return session.exec(statement).all()

@router.get("/classes/{class_id}/stats")
async def get_student_stats(
    class_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_student_role(current_user)
    
    from ..models import TopicScore, Topic, Score
    
    assignments = session.exec(select(Assignment).where(Assignment.class_id == class_id)).all()
    assignment_ids = [a.id for a in assignments]
    
    if not assignment_ids:
        return {
            "overall_average": None,
            "performance_over_time": [],
            "top_topics": [],
            "lowest_topics": []
        }
    
    overall_avg = session.exec(
        select(func.avg(Score.marks))
        .where(Score.assignment_id.in_(assignment_ids))
        .where(Score.student_id == current_user.id)
    ).first()
    
    performance = session.exec(
        select(Score.assignment_id, Score.marks)
        .where(Score.assignment_id.in_(assignment_ids))
        .where(Score.student_id == current_user.id)
    ).all()
    
    assignment_map = {a.id: a.title for a in assignments}
    performance_data = [
        {"assignment_name": assignment_map[p[0]], "marks": float(p[1]) if p[1] is not None else 0}
        for p in performance
    ]
    
    topic_stats = session.exec(
        select(TopicScore.topic_id, Topic.name, func.avg(TopicScore.marks))
        .join(Topic, TopicScore.topic_id == Topic.id)
        .where(TopicScore.assignment_id.in_(assignment_ids))
        .where(TopicScore.student_id == current_user.id)
        .group_by(TopicScore.topic_id, Topic.name)
        .order_by(func.avg(TopicScore.marks).desc())
    ).all()
    
    formatted_topics = [{"topic_name": ts[1], "average_marks": float(ts[2]) if ts[2] is not None else 0} for ts in topic_stats]
    top_topics = formatted_topics[:3]
    lowest_topics = formatted_topics[-3:] if len(formatted_topics) >= 3 else formatted_topics
    lowest_topics.reverse()
    
    return {
        "overall_average": float(overall_avg) if overall_avg is not None else None,
        "performance_over_time": performance_data,
        "top_topics": top_topics,
        "lowest_topics": lowest_topics
    }

