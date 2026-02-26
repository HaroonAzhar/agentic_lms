from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Annotated

from ..database import get_session
from ..models import User, UserRole, Class, Resource, Assignment, Grade, ClassEnrollment
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
