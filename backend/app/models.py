from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Relationship, JSON
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    ADMIN = "admin"
    TEACHER = "teacher"
    STUDENT = "student"

class UserBase(SQLModel):
    username: str = Field(index=True, unique=True)
    role: UserRole

class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    password_hash: str
    
    classes_taught: List["Class"] = Relationship(back_populates="teacher")
    enrollments: List["ClassEnrollment"] = Relationship(back_populates="student")
    scores: List["AssignmentGrade"] = Relationship(back_populates="student")
    question_responses: List["QuestionResponse"] = Relationship(back_populates="student")
    grade_comments: List["GradeReviewComment"] = Relationship(back_populates="user")

class ClassBase(SQLModel):
    name: str
    course_name: str

class Class(ClassBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    teacher_id: Optional[int] = Field(default=None, foreign_key="user.id")
    
    teacher: Optional[User] = Relationship(back_populates="classes_taught")
    students: List["ClassEnrollment"] = Relationship(back_populates="class_")
    resources: List["Resource"] = Relationship(back_populates="class_")
    assignments: List["Assignment"] = Relationship(back_populates="class_")

class ClassEnrollment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    class_id: int = Field(foreign_key="class.id")
    student_id: int = Field(foreign_key="user.id")
    
    class_: Class = Relationship(back_populates="students")
    student: User = Relationship(back_populates="enrollments")

class Topic(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    outline: Optional[str] = None
    
    occurrences: List["Occurrence"] = Relationship(back_populates="topic")

class ResourceType(str, Enum):
    VIDEO = "video"
    DOCUMENT = "document"
    ARTICLE = "article"

class ResourceBase(SQLModel):
    title: str
    type: ResourceType
    url: str
    content: Optional[str] = Field(default=None, description="Extracted text content")

class Resource(ResourceBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    class_id: int = Field(foreign_key="class.id")
    
    class_: Class = Relationship(back_populates="resources")
    occurrences: List["Occurrence"] = Relationship(back_populates="resource")



class Occurrence(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    topic_id: int = Field(foreign_key="topic.id")
    resource_id: Optional[int] = Field(default=None, foreign_key="resource.id")
    
    topic: Topic = Relationship(back_populates="occurrences")
    resource: Optional[Resource] = Relationship(back_populates="occurrences")
    key_concepts: List["KeyConcept"] = Relationship(back_populates="occurrence")

class TopicScore(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    topic_id: int = Field(foreign_key="topic.id")
    response_id: int = Field(foreign_key="questionresponse.id")
    marks: float
    
    topic: Topic = Relationship()
    response: "QuestionResponse" = Relationship(back_populates="topic_scores")

class KeyConcept(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: Optional[str] = None
    occurrence_id: int = Field(foreign_key="occurrence.id")
    timestamp_start: Optional[int] = None
    timestamp_end: Optional[int] = None
    page_number: Optional[int] = None
    section: Optional[str] = None
    
    occurrence: Occurrence = Relationship(back_populates="key_concepts")

class Assignment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    class_id: int = Field(foreign_key="class.id")
    title: str
    
    class_: Class = Relationship(back_populates="assignments")
    questions: List["Question"] = Relationship(back_populates="assignment")
    grades: List["AssignmentGrade"] = Relationship(back_populates="assignment")

class Question(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    assignment_id: int = Field(foreign_key="assignment.id")
    content: str
    
    assignment: Assignment = Relationship(back_populates="questions")
    responses: List["QuestionResponse"] = Relationship(back_populates="question")

class QuestionResponse(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: int = Field(foreign_key="user.id")
    question_id: int = Field(foreign_key="question.id")
    graded: bool = Field(default=False)
    grader: str = Field(default="ai")
    marks: Optional[float] = None
    content: str
    feedback: Optional[str] = None
    
    student: User = Relationship(back_populates="question_responses")
    question: Question = Relationship(back_populates="responses")
    topic_scores: List["TopicScore"] = Relationship(back_populates="response")
    comments: List["GradeReviewComment"] = Relationship(back_populates="response")

class AssignmentGrade(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    assignment_id: int = Field(foreign_key="assignment.id")
    student_id: int = Field(foreign_key="user.id")
    marks: float
    feedback: Optional[str] = None
    
    assignment: Assignment = Relationship(back_populates="grades")
    student: User = Relationship(back_populates="scores")

class GradeReviewComment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    response_id: int = Field(foreign_key="questionresponse.id")
    user_id: int = Field(foreign_key="user.id")
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    response: QuestionResponse = Relationship(back_populates="comments")
    user: User = Relationship(back_populates="grade_comments")
