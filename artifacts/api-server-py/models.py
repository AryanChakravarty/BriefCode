from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import Integer, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from pgvector.sqlalchemy import Vector

class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    hashed_password: str

    briefs: List["Brief"] = Relationship(back_populates="user")

class Brief(SQLModel, table=True):
    __tablename__ = "briefs"
    id: Optional[int] = Field(default=None, primary_key=True)
    input: str
    mode: str
    title: str
    sections: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSONB))
    jiraKey: Optional[str] = Field(default=None, sa_column=Column(name="jira_key"))
    prUrl: Optional[str] = Field(default=None, sa_column=Column(name="pr_url"))
    rawJira: Optional[str] = Field(default=None, sa_column=Column(name="raw_jira"))
    rawPr: Optional[str] = Field(default=None, sa_column=Column(name="raw_pr"))
    jiraContext: Optional[str] = Field(default=None, sa_column=Column(name="jira_context"))
    uploadedFiles: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSONB, name="uploaded_files"))
    createdAt: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(name="created_at", default=datetime.utcnow))
    
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    user: Optional[User] = Relationship(back_populates="briefs")

class FileChunk(SQLModel, table=True):
    __tablename__ = "file_chunks"
    id: Optional[int] = Field(default=None, primary_key=True)
    brief_id: int = Field(sa_column=Column(Integer, ForeignKey("briefs.id", ondelete="CASCADE"), nullable=False))
    file_name: str
    content: str
    embedding: List[float] = Field(sa_column=Column(Vector(768)))
