from sqlalchemy import Column, String, Text, DateTime, Enum, Date
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base
import enum
import uuid

Base = declarative_base()

# 定义枚举类型
class UpdateRecordType(str, enum.Enum):
    SUCCESS = "success"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"

class RequirementPriority(str, enum.Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class RequirementStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class SystemDoc(Base):
    __tablename__ = "system_docs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(100), nullable=False)
    createdAt = Column(DateTime(timezone=True), server_default=func.now())
    updatedAt = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class UpdateRecord(Base):
    __tablename__ = "update_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    date = Column(Date, nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    implementation = Column(Text, nullable=False)
    updateType = Column(Enum(UpdateRecordType), nullable=False)
    icon = Column(String(100))
    createdAt = Column(DateTime(timezone=True), server_default=func.now())

class Requirement(Base):
    __tablename__ = "requirements"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(Enum(RequirementPriority), nullable=False)
    status = Column(Enum(RequirementStatus), nullable=False)
    createdAt = Column(DateTime(timezone=True), server_default=func.now())
    updatedAt = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
