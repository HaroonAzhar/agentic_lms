from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from ..services.gcs_service import upload_to_gcs
from sqlmodel import Session, select
from sqlalchemy import func
from typing import List, Annotated

from ..database import get_session
from ..models import User, UserRole, Class, Resource, Assignment, AssignmentGrade, ResourceType, KeyConcept, Topic, Occurrence, Question, QuestionResponse
from pydantic import BaseModel
from ..auth import get_current_user
from ..services.agent_service import trigger_resource_analysis
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/teacher",
    tags=["teacher"],
    responses={404: {"description": "Not found"}},
)

def check_teacher_role(user: User):
    if user.role != UserRole.TEACHER and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")

@router.post("/resources", response_model=Resource)
async def add_resource(
    title: str = Form(...),
    type: ResourceType = Form(...),
    class_id: int = Form(...),
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    session: Session = Depends(get_session)
):
    check_teacher_role(current_user)
    
    logger.info(f"Attempting to upload resource: {title}, type: {type}, class_id: {class_id}")
    try:
        # Upload to GCS
        destination = f"classes/{class_id}/resources/{file.filename}"
        public_url = await upload_to_gcs(file, destination)
        logger.info(f"GCS Upload successful: {public_url}")
        
        resource_data = Resource(
            title=title,
            type=type,
            url=public_url,
            class_id=class_id,
            teacher_id=current_user.id
        )
        
        session.add(resource_data)
        session.commit()
        session.refresh(resource_data)
        logger.info(f"Resource saved to DB: {resource_data.id}")
        
        try:
            await trigger_resource_analysis(resource_data.id, resource_data.url)
        except Exception as e:
            logger.error(f"Analysis trigger failed (non-blocking): {e}")
            pass
        
        return resource_data

    except Exception as e:
        logger.error(f"Error in add_resource: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/class/activity/{class_id}", response_model=List[Assignment])
async def list_class_activities(
    class_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_teacher_role(current_user)
    # Optional: verify current_user is teacher for this class
    return session.exec(select(Assignment).where(Assignment.class_id == class_id)).all()

class AssignmentCreate(BaseModel):
    title: str
    questions: List[str]

@router.post("/class/activity/{class_id}", response_model=Assignment)
async def create_class_activity(
    class_id: int,
    assignment_data: AssignmentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_teacher_role(current_user)
    
    assignment = Assignment(class_id=class_id, title=assignment_data.title)
    session.add(assignment)
    session.commit()
    session.refresh(assignment)
    
    for q_text in assignment_data.questions:
        q = Question(assignment_id=assignment.id, content=q_text)
        session.add(q)
        
    session.commit()
    session.refresh(assignment)
    return assignment

@router.post("/assignments/{assignment_id}/score/{student_id}", response_model=AssignmentGrade)
async def grade_student(
    assignment_id: int,
    student_id: int,
    marks: float,
    feedback: str,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_teacher_role(current_user)
    score = AssignmentGrade(
        assignment_id=assignment_id,
        student_id=student_id,
        marks=marks,
        feedback=feedback
    )
    session.add(score)
    session.commit()
    session.refresh(score)
    return score

@router.get("/classes", response_model=List[Class])
async def list_teacher_classes(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_teacher_role(current_user)
    if current_user.role == UserRole.ADMIN:
        # Admins can see all classes? Or just return all for now to be safe/useful
        return session.exec(select(Class)).all()
    
    # Return classes where teacher_id matches
    return session.exec(select(Class).where(Class.teacher_id == current_user.id)).all()

@router.get("/classes/{class_id}/resources", response_model=List[Resource])
async def list_class_resources(
    class_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_teacher_role(current_user)
    resources = session.exec(select(Resource).where(Resource.class_id == class_id)).all()
    return resources
@router.get("/resources/{resource_id}/analysis")
async def get_resource_analysis(
    resource_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_teacher_role(current_user)
    
    # Get Resource
    resource = session.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    # Get Topics associated with this resource via Occurrences
    # We want to return { resource: ..., topics: [ {name: ..., occurrences: [...] } ] }
    # Let's verify if topics are linked.
    # Logic: Select Topic where Topic.id in (select topic_id from Occurrence where resource_id = X)
    
    from ..models import Topic, Occurrence, KeyConcept
    
    # Fetch all occurrences for this resource, loading topic and key_concepts
    occurrences = session.exec(
        select(Occurrence)
        .where(Occurrence.resource_id == resource_id)
    ).all()
    
    # Group by Topic
    topics_map = {}
    for occ in occurrences:
        # Manually load topic if not lazy loaded? SQLModel relationships are lazy by default? 
        # We need to ensure we have the topic.
        # It's better to use explicit join or .options(selectinload(...))
        # But for MVP loop is okay if volume is low.
        
        # Note: session.get(Topic, occ.topic_id) might be needed if relationship not loaded.
        # Let's assume lazy loading works or we re-fetch.
        
        # Actually, let's just return the raw occurrences and let frontend group?
        # Or construct a nice JSON.
        
        # Explicitly fetching to avoid N+1 if possible, but simplest is:
        topic = session.get(Topic, occ.topic_id)
        if not topic: continue
        
        if topic.id not in topics_map:
            topics_map[topic.id] = {
                "id": topic.id,
                "name": topic.name,
                "concepts": [] # We called it "occurrences" in the prompt, but effectively key concepts are time-bound?
                # Wait, Occurrence HAS KeyConcepts.
                # So Topic -> Occurrence -> KeyConcepts.
            }
            
        # Get KeyConcepts for this occurrence
        key_concepts = session.exec(select(KeyConcept).where(KeyConcept.occurrence_id == occ.id)).all()
        
        # Add to the structure. 
        # Frontend expects: Topic -> Concepts (with timestamps).
        # Our model: Occurrence (with Topic) -> KeyConcepts.
        # So multiple concepts in one occurrence share the same "time" roughly?
        # But KeyConcept has timestamp_start.
        
        for kc in key_concepts:
            topics_map[topic.id]["concepts"].append({
                "id": kc.id,
                "name": kc.name,
                "description": kc.description,
                "timestamp": kc.timestamp_start
            })

    return {
        "resource": resource,
        "topics": list(topics_map.values())
    }

@router.put("/key-concepts/{concept_id}", response_model=KeyConcept)
async def update_key_concept(
    concept_id: int,
    concept_data: KeyConcept,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_teacher_role(current_user)
    concept = session.get(KeyConcept, concept_id)
    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")
        
    concept.name = concept_data.name
    concept.description = concept_data.description
    # Update other fields if needed
    
    session.add(concept)
    session.commit()
    session.refresh(concept)
    return concept

@router.delete("/resources/{resource_id}")
async def delete_resource(
    resource_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_teacher_role(current_user)
    resource = session.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    # Check ownership (Teacher must own the class)
    # We need to fetch the class
    class_obj = session.get(Class, resource.class_id)
    if class_obj and class_obj.teacher_id != current_user.id and current_user.role != UserRole.ADMIN:
         raise HTTPException(status_code=403, detail="Not authorized to delete this resource")

    # Manually delete related data (Occurrences -> KeyConcepts)
    # 1. Get Occurrences
    occurrences = session.exec(select(Occurrence).where(Occurrence.resource_id == resource_id)).all()
    
    for occ in occurrences:
        # 2. Delete KeyConcepts for this occurrence
        concepts = session.exec(select(KeyConcept).where(KeyConcept.occurrence_id == occ.id)).all()
        for c in concepts:
            session.delete(c)
        # 3. Delete Occurrence
        session.delete(occ)
        
    # 4. Delete Resource
    session.delete(resource)
    session.commit()
    
    return {"ok": True}

@router.get("/classes/{class_id}/stats")
async def get_class_stats(
    class_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_teacher_role(current_user)
    
    from ..models import TopicScore, Topic, AssignmentGrade, QuestionResponse, Question
    
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
        select(func.avg(AssignmentGrade.marks)).where(AssignmentGrade.assignment_id.in_(assignment_ids))
    ).first()
    
    performance = session.exec(
        select(AssignmentGrade.assignment_id, func.avg(AssignmentGrade.marks))
        .where(AssignmentGrade.assignment_id.in_(assignment_ids))
        .group_by(AssignmentGrade.assignment_id)
    ).all()
    
    assignment_map = {a.id: a.title for a in assignments}
    performance_data = [
        {"assignment_name": assignment_map[p[0]], "average_marks": float(p[1]) if p[1] is not None else 0}
        for p in performance
    ]
    
    topic_stats = session.exec(
        select(TopicScore.topic_id, Topic.name, func.avg(TopicScore.marks))
        .join(Topic, TopicScore.topic_id == Topic.id)
        .join(QuestionResponse, TopicScore.response_id == QuestionResponse.id)
        .join(Question, QuestionResponse.question_id == Question.id)
        .where(Question.assignment_id.in_(assignment_ids))
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

class CommentCreate(BaseModel):
    content: str

class MarkUpdate(BaseModel):
    marks: float

@router.get("/assignments/{assignment_id}/submissions")
async def list_assignment_submissions(
    assignment_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_teacher_role(current_user)
    assignment = session.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    class_obj = session.get(Class, assignment.class_id)
    from ..models import ClassEnrollment
    enrollments = session.exec(select(ClassEnrollment).where(ClassEnrollment.class_id == assignment.class_id)).all()
    
    student_ids = [e.student_id for e in enrollments]
    students = session.exec(select(User).where(User.id.in_(student_ids))).all() if student_ids else []
    
    grades = session.exec(select(AssignmentGrade).where(AssignmentGrade.assignment_id == assignment_id)).all()
    grade_map = {g.student_id: g for g in grades}
    
    total_possible = len(assignment.questions) * 10.0
    
    submissions_data = []
    for student in students:
        grade = grade_map.get(student.id)
        percentage = (grade.marks / total_possible * 100) if (grade and total_possible > 0) else None
        
        submissions_data.append({
            "student_id": student.id,
            "student_name": student.username,
            "submitted": grade is not None,
            "marks": round(percentage, 1) if percentage is not None else None
        })
        
    return {
        "assignment_id": assignment.id,
        "title": assignment.title,
        "submissions": submissions_data
    }

@router.get("/assignments/{assignment_id}/submissions/{student_id}")
async def get_student_submission_review(
    assignment_id: int,
    student_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_teacher_role(current_user)
    assignment = session.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    grade = session.exec(select(AssignmentGrade).where(AssignmentGrade.assignment_id == assignment_id, AssignmentGrade.student_id == student_id)).first()
    if not grade:
        raise HTTPException(status_code=400, detail="Assignment not yet graded for this student")
        
    student = session.get(User, student_id)
        
    questions = session.exec(select(Question).where(Question.assignment_id == assignment_id)).all()
    
    responses_data = []
    for q in questions:
        resp = session.exec(select(QuestionResponse).where(QuestionResponse.question_id == q.id, QuestionResponse.student_id == student_id)).first()
        
        if resp:
            from ..models import GradeReviewComment
            comments = session.exec(select(GradeReviewComment).where(GradeReviewComment.response_id == resp.id).order_by(GradeReviewComment.created_at)).all()
            comments_data = []
            for c in comments:
                c_user = session.get(User, c.user_id)
                comments_data.append({
                    "id": c.id, 
                    "content": c.content, 
                    "user_id": c.user_id,
                    "user_name": c_user.username if c_user else "Unknown",
                    "user_role": c_user.role if c_user else "Unknown",
                    "created_at": c.created_at
                })
            
            responses_data.append({
                "question_id": q.id,
                "question_content": q.content,
                "response_id": resp.id,
                "response_content": resp.content,
                "marks": resp.marks,
                "feedback": resp.feedback,
                "comments": comments_data
            })
            
    total_possible = len(questions) * 10.0
    percentage = (grade.marks / total_possible) * 100 if total_possible > 0 else 0
    
    return {
        "assignment_id": assignment.id,
        "title": assignment.title,
        "student_id": student.id,
        "student_name": student.username,
        "overall_marks": round(percentage, 1),
        "overall_feedback": grade.feedback,
        "responses": responses_data
    }

@router.post("/responses/{response_id}/comments")
async def add_teacher_comment(
    response_id: int,
    comment: CommentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_teacher_role(current_user)
    
    resp = session.get(QuestionResponse, response_id)
    if not resp:
        raise HTTPException(status_code=404, detail="Response not found")
        
    from ..models import GradeReviewComment
    new_comment = GradeReviewComment(
        response_id=response_id,
        user_id=current_user.id,
        content=comment.content
    )
    session.add(new_comment)
    session.commit()
    session.refresh(new_comment)
    
    return new_comment

@router.put("/responses/{response_id}/marks")
async def update_response_marks(
    response_id: int,
    mark_update: MarkUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_teacher_role(current_user)
    
    resp = session.get(QuestionResponse, response_id)
    if not resp:
        raise HTTPException(status_code=404, detail="Response not found")
        
    # Update the specific response's mark
    resp.marks = mark_update.marks
    session.add(resp)
    session.commit()
    
    # Now recalculate the overall assignment grade
    q = session.get(Question, resp.question_id)
    if q:
        assignment_id = q.assignment_id
        student_id = resp.student_id
        
        # Get all questions for this assignment
        questions = session.exec(select(Question).where(Question.assignment_id == assignment_id)).all()
        q_ids = [q.id for q in questions]
        
        # Get all responses for this student for this assignment
        all_resps = session.exec(select(QuestionResponse).where(QuestionResponse.question_id.in_(q_ids), QuestionResponse.student_id == student_id)).all()
        
        total_marks = sum([r.marks for r in all_resps if r.marks is not None])
        
        # Update AssignmentGrade
        grade = session.exec(select(AssignmentGrade).where(AssignmentGrade.assignment_id == assignment_id, AssignmentGrade.student_id == student_id)).first()
        if grade:
            grade.marks = total_marks
            session.add(grade)
            session.commit()
            
    return {"status": "success", "new_marks": resp.marks}
