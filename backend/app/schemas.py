"""
app/schemas.py
Schemas Pydantic
"""
from pydantic import BaseModel, validator, Field
from typing import List, Optional, Literal
from datetime import datetime

class QuestionnaireCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)

    @validator('name')
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError('Nome não pode ser vazio')
        return v.strip()

class QuestionnaireOut(BaseModel):
    id: int
    name: str
    questions_count: int
    interviews_count: int = 0  # NOVO CAMPO
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

class QuestionCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)
    type: Literal["open", "multiple_choice"]
    options: List[str] = Field(default_factory=list)
    position: int = Field(..., ge=0)

    @validator('text')
    def validate_text(cls, v):
        if not v.strip():
            raise ValueError('Texto da pergunta não pode ser vazio')
        return v.strip()

    @validator('options')
    def validate_options(cls, v, values):
        question_type = values.get('type')
        if question_type == 'multiple_choice':
            cleaned_options = [opt.strip() for opt in v if opt.strip()]
            if len(cleaned_options) < 2:
                raise ValueError('Perguntas de múltipla escolha devem ter pelo menos 2 opções válidas')
            return cleaned_options
        return v

class QuestionOut(BaseModel):
    id: int
    text: str
    type: str
    options: List[str]
    position: int

    class Config:
        from_attributes = True

# --- COLETA DE DADOS ---

class InterviewOut(BaseModel):
    id: int
    number: int

    class Config:
        from_attributes = True

class AnswerCreate(BaseModel):
    interview_id: int = Field(..., gt=0)
    question_id: int = Field(..., gt=0)
    text: Optional[str] = None
    option_index: Optional[int] = Field(None, ge=0)

class AnswerOut(BaseModel):
    id: int
    interview_id: int
    question_id: int
    text: Optional[str]
    option_index: Optional[int]

    class Config:
        from_attributes = True