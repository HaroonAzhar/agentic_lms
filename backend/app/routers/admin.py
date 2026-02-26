from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, SQLModel
from typing import List, Annotated, Optional

from ..database import get_session
from ..models import User, UserRole, Class, ClassEnrollment
from ..auth import get_current_user

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    responses={404: {"description": "Not found"}},
)

def check_admin_role(user: User):
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")

from ..auth import get_password_hash

@router.post("/users", response_model=User)
async def create_user(
    user_data: User,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_admin_role(current_user)
    # Check existing
    if session.exec(select(User).where(User.username == user_data.username)).first():
        raise HTTPException(status_code=400, detail="Username exists")
        
    user_data.password_hash = get_password_hash(user_data.password_hash)
    
    session.add(user_data)
    session.commit()
    session.refresh(user_data)
    return user_data

@router.get("/users", response_model=List[User])
async def list_users(
    current_user: Annotated[User, Depends(get_current_user)],
    role: UserRole = None,
    session: Session = Depends(get_session)
):
    check_admin_role(current_user)
    query = select(User)
    if role:
        query = query.where(User.role == role)
    return session.exec(query).all()

class UserUpdate(SQLModel):
    username: Optional[str] = None
    role: Optional[UserRole] = None
    password: Optional[str] = None

@router.put("/users/{user_id}", response_model=User)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_admin_role(current_user)
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_update.username:
        # Check uniqueness if username changed
        if user_update.username != db_user.username:
            existing = session.exec(select(User).where(User.username == user_update.username)).first()
            if existing:
                raise HTTPException(status_code=400, detail="Username already exists")
        db_user.username = user_update.username
        
    if user_update.role:
        db_user.role = user_update.role
        
    if user_update.password:
        from ..auth import get_password_hash
        db_user.password_hash = get_password_hash(user_update.password)
        
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_admin_role(current_user)
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    session.delete(user)
    session.commit()
    return {"ok": True}

@router.post("/classes", response_model=Class)
async def create_class(
    class_data: Class,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_admin_role(current_user)
    session.add(class_data)
    session.commit()
    session.refresh(class_data)
    return class_data

@router.get("/classes", response_model=List[Class])
async def list_classes(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_admin_role(current_user)
    return session.exec(select(Class)).all()

@router.delete("/classes/{class_id}")
async def delete_class(
    class_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_admin_role(current_user)
    class_obj = session.get(Class, class_id)
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")
    session.delete(class_obj)
    session.commit()
    return {"ok": True}

@router.post("/classes/{class_id}/enroll", response_model=ClassEnrollment)
async def enroll_student(
    class_id: int,
    student_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_admin_role(current_user)
    # Check if already enrolled
    existing = session.exec(select(ClassEnrollment).where(
        ClassEnrollment.class_id == class_id, 
        ClassEnrollment.student_id == student_id
    )).first()
    if existing:
        return existing

    enrollment = ClassEnrollment(class_id=class_id, student_id=student_id)
    session.add(enrollment)
    session.commit()
    session.refresh(enrollment)
    return enrollment

@router.delete("/classes/{class_id}/enroll/{student_id}")
async def unenroll_student(
    class_id: int,
    student_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_admin_role(current_user)
    enrollment = session.exec(select(ClassEnrollment).where(
        ClassEnrollment.class_id == class_id,
        ClassEnrollment.student_id == student_id
    )).first()
    
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
        
    session.delete(enrollment)
    session.commit()
    return {"ok": True}

@router.get("/classes/{class_id}/students", response_model=List[User])
async def list_class_students(
    class_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_admin_role(current_user)
    # Join ClassEnrollment and User to get users enrolled in the class
    statement = (
        select(User)
        .join(ClassEnrollment, User.id == ClassEnrollment.student_id)
        .where(ClassEnrollment.class_id == class_id)
    )
    return session.exec(statement).all()
