"""
app/dependencies.py
Dependências e funções utilitárias compartilhadas
"""
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import Questionnaire

def get_db():
    """Gerenciador de contexto para sessões do banco de dados."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_questionnaire_or_404(qid: int, db: Session) -> Questionnaire:
    """
    Busca um questionário pelo ID ou lança exceção 404.
    Refatoração: Centraliza a validação de existência.
    """
    questionnaire = db.query(Questionnaire).filter(Questionnaire.id == qid).first()
    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Questionário com ID {qid} não encontrado"
        )
    return questionnaire