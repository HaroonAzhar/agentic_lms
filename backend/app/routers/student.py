from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy import func
from typing import List, Annotated

from pydantic import BaseModel
from ..database import get_session
from ..models import User, UserRole, Class, Resource, Assignment, AssignmentGrade, ClassEnrollment, Question, QuestionResponse
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

class AssignmentWithQuestions(BaseModel):
    id: int
    class_id: int
    title: str
    questions: List[Question]

@router.get("/assignments/{assignment_id}", response_model=AssignmentWithQuestions)
async def get_assignment(
    assignment_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_student_role(current_user)
    assignment = session.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    questions = session.exec(select(Question).where(Question.assignment_id == assignment_id)).all()
    return {
        "id": assignment.id,
        "class_id": assignment.class_id,
        "title": assignment.title,
        "questions": questions
    }


@router.get("/classes/{class_id}/stats")
async def get_student_stats(
    class_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_student_role(current_user)
    
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
    
    questions = session.exec(select(Question).where(Question.assignment_id.in_(assignment_ids))).all()
    assignment_totals = {}
    for q in questions:
        assignment_totals[q.assignment_id] = assignment_totals.get(q.assignment_id, 0) + 10.0

    performance = session.exec(
        select(AssignmentGrade.assignment_id, AssignmentGrade.marks)
        .where(AssignmentGrade.assignment_id.in_(assignment_ids))
        .where(AssignmentGrade.student_id == current_user.id)
    ).all()
    
    topic_scores_by_assignment = {}
    topic_query = session.exec(
        select(Question.assignment_id, Topic.name, func.avg(TopicScore.marks))
        .join(TopicScore, TopicScore.topic_id == Topic.id)
        .join(QuestionResponse, TopicScore.response_id == QuestionResponse.id)
        .join(Question, QuestionResponse.question_id == Question.id)
        .where(Question.assignment_id.in_(assignment_ids))
        .where(QuestionResponse.student_id == current_user.id)
        .group_by(Question.assignment_id, Topic.name)
    ).all()

    for a_id, t_name, avg_mark in topic_query:
        if a_id not in topic_scores_by_assignment:
            topic_scores_by_assignment[a_id] = []
        topic_scores_by_assignment[a_id].append({"name": t_name, "score": float(avg_mark) if avg_mark is not None else 0})

    assignment_map = {a.id: a.title for a in assignments}
    performance_data = []
    total_percentage_sum = 0
    percentage_count = 0
    
    for p in performance:
        a_id = p[0]
        marks = float(p[1]) if p[1] is not None else 0
        total_possible = assignment_totals.get(a_id, 0)
        
        if total_possible > 0:
            percentage = (marks / total_possible) * 100
            total_percentage_sum += percentage
            percentage_count += 1
        else:
            percentage = 0
            
        a_topics = topic_scores_by_assignment.get(a_id, [])
        a_topics.sort(key=lambda x: x["score"])
        worst_topics = [t["name"] for t in a_topics[:3]]
        
        performance_data.append({
            "assignment_name": assignment_map[a_id], 
            "marks": percentage,
            "worst_topics": worst_topics
        })
        
    overall_avg = (total_percentage_sum / percentage_count) if percentage_count > 0 else None
    
    topic_stats = session.exec(
        select(TopicScore.topic_id, Topic.name, func.avg(TopicScore.marks))
        .join(Topic, TopicScore.topic_id == Topic.id)
        .join(QuestionResponse, TopicScore.response_id == QuestionResponse.id)
        .join(Question, QuestionResponse.question_id == Question.id)
        .where(Question.assignment_id.in_(assignment_ids))
        .where(QuestionResponse.student_id == current_user.id)
        .group_by(TopicScore.topic_id, Topic.name)
        .order_by(func.avg(TopicScore.marks).desc())
    ).all()
    
    formatted_topics = [{"topic_name": ts[1], "average_marks": (float(ts[2]) / 10.0) * 100 if ts[2] is not None else 0} for ts in topic_stats]
    top_topics = formatted_topics[:3]
    lowest_topics = formatted_topics[-3:] if len(formatted_topics) >= 3 else formatted_topics
    lowest_topics.reverse()
    
    return {
        "overall_average": float(overall_avg) if overall_avg is not None else None,
        "performance_over_time": performance_data,
        "top_topics": top_topics,
        "lowest_topics": lowest_topics
    }


class SubmissionItem(BaseModel):
    question_id: int
    answer: str
    
class AssignmentSubmission(BaseModel):
    responses: List[SubmissionItem]

@router.post("/assignments/{assignment_id}/submit")
async def submit_assignment(
    assignment_id: int,
    submission: AssignmentSubmission,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_student_role(current_user)
    
    assignment = session.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    # --- UPSERT QUESTION RESPONSES ---
    saved_responses = {}
    for item in submission.responses:
        # Check if response already exists
        qr = session.exec(
            select(QuestionResponse)
            .where(
                QuestionResponse.student_id == current_user.id,
                QuestionResponse.question_id == item.question_id
            )
        ).first()

        if qr:
            qr.content = item.answer
            qr.graded = False
        else:
            qr = QuestionResponse(
                student_id=current_user.id,
                question_id=item.question_id,
                content=item.answer,
                graded=False,
                grader="ai"
            )
            session.add(qr)
            
        session.flush() 
        saved_responses[item.question_id] = qr
        
    session.commit()
    
    class_id = assignment.class_id
    resources = session.exec(select(Resource).where(Resource.class_id == class_id)).all()
    resource_ids = [r.id for r in resources]
    
    topics_data = []
    if resource_ids:
        from ..models import Occurrence, Topic, KeyConcept
        occurrences = session.exec(select(Occurrence).where(Occurrence.resource_id.in_(resource_ids))).all()
        topic_ids = list(set([o.topic_id for o in occurrences]))
        if topic_ids:
            topics = session.exec(select(Topic).where(Topic.id.in_(topic_ids))).all()
            for t in topics:
                t_occs = [o for o in occurrences if o.topic_id == t.id]
                t_occ_ids = [o.id for o in t_occs]
                kcs = session.exec(select(KeyConcept).where(KeyConcept.occurrence_id.in_(t_occ_ids))).all()
                kcs_data = [
                    {
                        "key_concept_id": kc.id,
                        "key_concept_name": kc.name,
                        "key_concept_description": kc.description
                    }
                    for kc in kcs
                ]
                topics_data.append({
                    "topic_id": t.id,
                    "topic_name": t.name,
                    "topic_outline": t.outline,
                    "key_concepts": kcs_data
                })
    
    questions = session.exec(select(Question).where(Question.assignment_id == assignment_id)).all()
    question_map = {q.id: q.content for q in questions}
    
    questions_with_answers = []
    for item in submission.responses:
        q_content = question_map.get(item.question_id, "Unknown Question")
        questions_with_answers.append({
            "question_id": item.question_id,
            "question": q_content,
            "answer": item.answer
        })
        
    from ..services.agent_service import grade_assignment_submission
    result = await grade_assignment_submission(assignment_id, current_user.id, questions_with_answers, topics_data)
    
    if result:
        from ..models import TopicScore
        
        # --- UPSERT ASSIGNMENT GRADE ---
        grade = session.exec(
            select(AssignmentGrade)
            .where(
                AssignmentGrade.assignment_id == assignment_id,
                AssignmentGrade.student_id == current_user.id
            )
        ).first()
        
        if grade:
            grade.marks = result.get("assignment_marks", 0.0)
            grade.feedback = result.get("feedback", "")
        else:
            grade = AssignmentGrade(
                assignment_id=assignment_id,
                student_id=current_user.id,
                marks=result.get("assignment_marks", 0.0),
                feedback=result.get("feedback", "")
            )
            session.add(grade)
        
        for qs in result.get("question_scores", []):
            qr = saved_responses.get(qs.get("question_id"))
            if qr:
                qr.marks = qs.get("marks", 0.0)
                qr.feedback = qs.get("feedback", "")
                
        first_qr_id = None
        for item in submission.responses:
            first_qr_id = saved_responses[item.question_id].id
            break
            
        if first_qr_id:
            # Wipe old topic scores for this response before adding new ones
            old_ts = session.exec(select(TopicScore).where(TopicScore.response_id == first_qr_id)).all()
            for old in old_ts:
                session.delete(old)
                
            for ts in result.get("topic_scores", []):
                topic_score = TopicScore(
                    topic_id=ts.get("topic_id"),
                    response_id=first_qr_id,
                    marks=ts.get("marks", 0.0)
                )
                session.add(topic_score)
                
        for qr in saved_responses.values():
            qr.graded = True
            session.add(qr)
            
        session.commit()
        
        total_possible = len(questions_with_answers) * 10.0
        percentage = (grade.marks / total_possible) * 100 if total_possible > 0 else 0
        
        return {
            "status": "success", 
            "marks": round(percentage, 1), 
            "feedback": grade.feedback, 
            "topic_scores": result.get("topic_scores", []),
            "question_scores": result.get("question_scores", [])
        }
    else:
        return {"status": "pending", "message": "Agent grading failed or is pending background execution"}

class CommentCreate(BaseModel):
    content: str

@router.get("/assignments/{assignment_id}/review")
async def get_assignment_review(
    assignment_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_student_role(current_user)
    assignment = session.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    grade = session.exec(select(AssignmentGrade).where(AssignmentGrade.assignment_id == assignment_id, AssignmentGrade.student_id == current_user.id)).first()
    if not grade:
        raise HTTPException(status_code=400, detail="Assignment not yet graded")
        
    questions = session.exec(select(Question).where(Question.assignment_id == assignment_id)).all()
    
    responses_data = []
    for q in questions:
        resp = session.exec(select(QuestionResponse).where(QuestionResponse.question_id == q.id, QuestionResponse.student_id == current_user.id)).first()
        
        if resp:
            from ..models import GradeReviewComment, User
            comments = session.exec(select(GradeReviewComment).where(GradeReviewComment.response_id == resp.id).order_by(GradeReviewComment.created_at)).all()
            comments_data = []
            for c in comments:
                user = session.get(User, c.user_id)
                comments_data.append({
                    "id": c.id, 
                    "content": c.content, 
                    "user_id": c.user_id,
                    "user_name": user.username if user else "Unknown",
                    "user_role": user.role if user else "Unknown",
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
        "overall_marks": round(percentage, 1),
        "overall_feedback": grade.feedback,
        "responses": responses_data
    }

@router.post("/responses/{response_id}/comments")
async def add_student_comment(
    response_id: int,
    comment: CommentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Session = Depends(get_session)
):
    check_student_role(current_user)
    
    resp = session.get(QuestionResponse, response_id)
    if not resp:
        raise HTTPException(status_code=404, detail="Response not found")
        
    if resp.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to comment on this response")
        
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
