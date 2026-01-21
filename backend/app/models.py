"""
app/models.py
Modelos do banco de dados
"""

from sqlalchemy import Column, Integer, String, ForeignKey, Index, UniqueConstraint, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum
from app.database import Base

class QuestionType(str, Enum):
    OPEN = "open"
    MULTIPLE_CHOICE = "multiple_choice"

class Questionnaire(Base):
    """Questionário contendo múltiplas perguntas"""
    __tablename__ = "questionnaires"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    # NOVO CAMPO: Data de criação
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    questions = relationship(
        "Question",
        back_populates="questionnaire",
        cascade="all, delete-orphan"
    )
    interviews = relationship(
        "Interview",
        back_populates="questionnaire",
        cascade="all, delete-orphan"
    )

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    questionnaire_id = Column(
        Integer,
        ForeignKey("questionnaires.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    text = Column(String, nullable=False)
    type = Column(String, nullable=False) 
    position = Column(Integer, nullable=False)

    questionnaire = relationship("Questionnaire", back_populates="questions")
    
    options_list = relationship(
        "QuestionOption",
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="QuestionOption.position"
    )

    __table_args__ = (
        Index('ix_question_questionnaire_position', 'questionnaire_id', 'position'),
    )

class QuestionOption(Base):
    __tablename__ = "question_options"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(
        Integer, 
        ForeignKey("questions.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    text = Column(String, nullable=False)
    position = Column(Integer, nullable=False)

    question = relationship("Question", back_populates="options_list")

class Interview(Base):
    __tablename__ = "interviews"

    id = Column(Integer, primary_key=True, index=True)
    questionnaire_id = Column(
        Integer,
        ForeignKey("questionnaires.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    number = Column(Integer, nullable=False)

    questionnaire = relationship("Questionnaire", back_populates="interviews")
    answers = relationship(
        "Answer",
        back_populates="interview",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint('questionnaire_id', 'number', name='uix_questionnaire_number'),
        Index('ix_interview_questionnaire_number', 'questionnaire_id', 'number'),
    )

class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(
        Integer,
        ForeignKey("interviews.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    question_id = Column(
        Integer,
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    text = Column(String, nullable=True)
    option_index = Column(Integer, nullable=True)

    interview = relationship("Interview", back_populates="answers")
    question = relationship("Question")

    __table_args__ = (
        UniqueConstraint('interview_id', 'question_id', name='uix_interview_question'),
        Index('ix_answer_interview_question', 'interview_id', 'question_id'),
    )