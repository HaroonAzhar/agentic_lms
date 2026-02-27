from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from ..services.gcs_service import upload_to_gcs
from sqlmodel import Session, select
from sqlalchemy import func
from typing import List, Annotated

from ..database import get_session
from ..models import User, UserRole, Class, Resource, Assignment, Score, ResourceType, KeyConcept, Topic, Occurrence
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

@router.post("/class/activity/{class_id}", response_model=Assignment)
async def create_class_activity(
    class_id: int,
    assignment_data: Assignment,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_teacher_role(current_user)
    # Ensure the assignment is tied to the path class_id
    assignment_data.class_id = class_id
    
    # We clear the ID in case the frontend sends one during creation
    assignment_data.id = None 
    
    session.add(assignment_data)
    session.commit()
    session.refresh(assignment_data)
    return assignment_data

@router.post("/assignments/{assignment_id}/score/{student_id}", response_model=Score)
async def grade_student(
    assignment_id: int,
    student_id: int,
    marks: float,
    feedback: str,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_teacher_role(current_user)
    score = Score(
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
        select(func.avg(Score.marks)).where(Score.assignment_id.in_(assignment_ids))
    ).first()
    
    performance = session.exec(
        select(Score.assignment_id, func.avg(Score.marks))
        .where(Score.assignment_id.in_(assignment_ids))
        .group_by(Score.assignment_id)
    ).all()
    
    assignment_map = {a.id: a.title for a in assignments}
    performance_data = [
        {"assignment_name": assignment_map[p[0]], "average_marks": float(p[1]) if p[1] is not None else 0}
        for p in performance
    ]
    
    topic_stats = session.exec(
        select(TopicScore.topic_id, Topic.name, func.avg(TopicScore.marks))
        .join(Topic, TopicScore.topic_id == Topic.id)
        .where(TopicScore.assignment_id.in_(assignment_ids))
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
