"""
app/routes/collection.py
Endpoints para a interface de Coleta de Dados (Entrevistas).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.dependencies import get_db, get_questionnaire_or_404
from app.models import Questionnaire, Question, Answer, Interview, QuestionType
from app.schemas import AnswerCreate, AnswerOut, InterviewOut

router = APIRouter(prefix="/collection", tags=["Collection"])

@router.get("/{qid}/last")
def get_last_interview_number(qid: int, db: Session = Depends(get_db)):
    """Retorna o número da última entrevista criada para controle de sequência."""
    get_questionnaire_or_404(qid, db)
    max_num = db.query(func.max(Interview.number)).filter(Interview.questionnaire_id == qid).scalar()
    return {"last": max_num if max_num else 1}

@router.get("/{qid}/interview/{number}")
def get_interview_data(qid: int, number: int, db: Session = Depends(get_db)):
    """
    Busca os dados de uma entrevista específica (perguntas + respostas).
    Se a entrevista não existir, cria automaticamente (rascunho).
    """
    get_questionnaire_or_404(qid, db)
    
    # Busca a entrevista pelo número
    interview = db.query(Interview).filter(
        Interview.questionnaire_id == qid,
        Interview.number == number
    ).first()
    
    # Se não existe, cria (Auto-create draft)
    if not interview:
        interview = Interview(questionnaire_id=qid, number=number)
        db.add(interview)
        db.commit()
        db.refresh(interview)
        
    # Carrega perguntas ordenadas
    questions = db.query(Question).filter(Question.questionnaire_id == qid).order_by(Question.position).all()
    
    # Carrega respostas existentes para esta entrevista
    answers = {}
    db_answers = db.query(Answer).filter(Answer.interview_id == interview.id).all()
    for ans in db_answers:
        answers[ans.question_id] = {
            "text": ans.text,
            "option_index": ans.option_index
        }
        
    # Monta resposta JSON estruturada
    return {
        "interview": {"id": interview.id, "number": interview.number},
        "questions": [
            {
                "id": q.id, 
                "text": q.text, 
                "type": q.type, 
                "position": q.position,
                "options": [o.text for o in q.options_list]
            } for q in questions
        ],
        "answers": answers
    }

@router.post("/{qid}/answer")
def save_answer_data(qid: int, payload: AnswerCreate, db: Session = Depends(get_db)):
    """
    Salva ou atualiza uma resposta individual.
    Retorna flag 'is_complete' indicando se o questionário inteiro foi preenchido.
    """
    # Verifica se já existe resposta para essa pergunta nessa entrevista
    existing = db.query(Answer).filter(
        Answer.interview_id == payload.interview_id,
        Answer.question_id == payload.question_id
    ).first()
    
    if existing:
        existing.text = payload.text
        existing.option_index = payload.option_index
    else:
        new_ans = Answer(**payload.dict())
        db.add(new_ans)
        
    db.commit()
    
    # Verifica completude para auto-avanço
    total_q = db.query(Question).filter(Question.questionnaire_id == qid).count()
    answered_q = db.query(Answer).filter(Answer.interview_id == payload.interview_id).count()
    
    return {"status": "saved", "is_complete": answered_q >= total_q}

@router.get("/{qid}/status_map")
def get_interviews_status_map(qid: int, db: Session = Depends(get_db)):
    """
    Gera um mapa de todas as entrevistas existentes e seu status de completude.
    Usado para exibir a grade de bolinhas Verdes/Vermelhas no frontend.
    """
    get_questionnaire_or_404(qid, db)

    # 1. Total de Perguntas do Questionário
    total_questions = db.query(Question).filter(Question.questionnaire_id == qid).count()
    
    # 2. Busca todas as entrevistas e conta quantas respostas cada uma tem
    # Usamos outerjoin para incluir entrevistas que têm 0 respostas
    results = (
        db.query(Interview.number, func.count(Answer.id))
        .outerjoin(Answer, Answer.interview_id == Interview.id)
        .filter(Interview.questionnaire_id == qid)
        .group_by(Interview.id)
        .order_by(Interview.number)
        .all()
    )
    
    status_map = []
    
    if not results:
        # Se não houver entrevistas, retorna lista vazia
        return []

    for num, count in results:
        # Lógica para decidir se exibe no mapa:
        # Exibe se tiver respostas OU se for a entrevista número 1 (mesmo vazia)
        # Isso evita poluir o mapa com a entrevista "n+1" vazia criada automaticamente,
        # a menos que o usuário queira navegar nela.
        
        # O cálculo de "missing" ajuda o frontend a saber quantas faltam
        missing = total_questions - count
        
        status_map.append({
            "number": num,
            "answered": count,
            "total": total_questions,
            "is_complete": count >= total_questions, # Bool para Verde/Vermelho
            "missing": max(0, missing)
        })
            
    return status_map