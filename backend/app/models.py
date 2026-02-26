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
    grades: List["Grade"] = Relationship(back_populates="student")

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

class Topic(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    outline: Optional[str] = None
    
    occurrences: List["Occurrence"] = Relationship(back_populates="topic")

class Occurrence(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    topic_id: int = Field(foreign_key="topic.id")
    resource_id: int = Field(foreign_key="resource.id")
    
    topic: Topic = Relationship(back_populates="occurrences")
    resource: Resource = Relationship(back_populates="occurrences")
    key_concepts: List["KeyConcept"] = Relationship(back_populates="occurrence")

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
    questions: Dict[str, Any] = Field(default={}, sa_type=JSON)
    
    class_: Class = Relationship(back_populates="assignments")
    grades: List["Grade"] = Relationship(back_populates="assignment")

class Grade(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    assignment_id: int = Field(foreign_key="assignment.id")
    student_id: int = Field(foreign_key="user.id")
    score: float
    feedback: Optional[str] = None
    
    assignment: Assignment = Relationship(back_populates="grades")
    student: User = Relationship(back_populates="grades")
