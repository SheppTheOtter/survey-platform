"""
app/routes/questionnaires.py
Endpoints para gerenciamento de questionários
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from app.dependencies import get_db, get_questionnaire_or_404
from app.models import Questionnaire, Question, QuestionOption, Answer, QuestionType, Interview
from app.schemas import QuestionnaireCreate, QuestionnaireOut, QuestionCreate, QuestionOut
import csv
import io

router = APIRouter(prefix="/questionnaires", tags=["Questionnaires"])

@router.get("/", response_model=list[QuestionnaireOut])
def list_questionnaires(
    q: str | None = Query(None, description="Buscar por nome"),
    db: Session = Depends(get_db)
):
    # CORREÇÃO: Contagem de entrevistas
    # Antes: func.count(distinct(Interview.id)) -> Contava entrevistas vazias
    # Agora: func.count(distinct(Answer.interview_id)) -> Conta apenas se tiver pelo menos 1 resposta
    query = (
        db.query(
            Questionnaire,
            func.count(distinct(Question.id)).label("questions_count"),
            func.count(distinct(Answer.interview_id)).label("interviews_count")
        )
        .outerjoin(Question, Question.questionnaire_id == Questionnaire.id)
        .outerjoin(Interview, Interview.questionnaire_id == Questionnaire.id)
        .outerjoin(Answer, Answer.interview_id == Interview.id) # Join extra para verificar respostas
        .group_by(Questionnaire.id)
    )

    if q:
        query = query.filter(Questionnaire.name.ilike(f"%{q}%"))

    questionnaires = query.order_by(Questionnaire.created_at.desc()).all()

    return [
        QuestionnaireOut(
            id=qn.Questionnaire.id,
            name=qn.Questionnaire.name,
            questions_count=qn.questions_count or 0,
            interviews_count=qn.interviews_count or 0,
            created_at=qn.Questionnaire.created_at
        )
        for qn in questionnaires
    ]

@router.post("/", response_model=QuestionnaireOut, status_code=status.HTTP_201_CREATED)
def create_questionnaire(payload: QuestionnaireCreate, db: Session = Depends(get_db)):
    questionnaire = Questionnaire(name=payload.name)
    db.add(questionnaire)
    db.commit()
    db.refresh(questionnaire)

    return QuestionnaireOut(
        id=questionnaire.id,
        name=questionnaire.name,
        questions_count=0,
        interviews_count=0,
        created_at=questionnaire.created_at
    )

@router.put("/{qid}", status_code=status.HTTP_200_OK)
def rename_questionnaire(
    qid: int,
    payload: QuestionnaireCreate,
    db: Session = Depends(get_db)
):
    questionnaire = get_questionnaire_or_404(qid, db)
    questionnaire.name = payload.name
    db.commit()
    return {"status": "ok", "message": "Questionário renomeado"}

@router.post("/{qid}/duplicate", response_model=QuestionnaireOut, status_code=status.HTTP_201_CREATED)
def duplicate_questionnaire(qid: int, db: Session = Depends(get_db)):
    source = get_questionnaire_or_404(qid, db)
    
    duplicate = Questionnaire(name=f"{source.name} (Cópia)")
    db.add(duplicate)
    db.commit()
    db.refresh(duplicate)
    
    questions = (
        db.query(Question)
        .filter(Question.questionnaire_id == qid)
        .order_by(Question.position)
        .all()
    )
    
    for q in questions:
        new_q = Question(
            questionnaire_id=duplicate.id,
            text=q.text,
            type=q.type,
            position=q.position
        )
        db.add(new_q)
        db.flush() 

        for opt in q.options_list:
            db.add(QuestionOption(
                question_id=new_q.id,
                text=opt.text,
                position=opt.position
            ))
    
    db.commit()
    
    return QuestionnaireOut(
        id=duplicate.id,
        name=duplicate.name,
        questions_count=len(questions),
        interviews_count=0,
        created_at=duplicate.created_at
    )

@router.delete("/{qid}", status_code=status.HTTP_200_OK)
def delete_questionnaire(qid: int, db: Session = Depends(get_db)):
    questionnaire = get_questionnaire_or_404(qid, db)
    db.delete(questionnaire)
    db.commit()
    return {"status": "ok", "message": "Questionário deletado"}

@router.delete("/{qid}/interviews", status_code=status.HTTP_200_OK)
def delete_questionnaire_interviews(qid: int, db: Session = Depends(get_db)):
    get_questionnaire_or_404(qid, db)
    count = db.query(Interview).filter(Interview.questionnaire_id == qid).delete()
    db.commit()
    return {"status": "ok", "message": f"{count} entrevistas excluídas."}

@router.get("/{qid}/questions", response_model=list[QuestionOut])
def list_questions(qid: int, db: Session = Depends(get_db)):
    get_questionnaire_or_404(qid, db)
    
    questions = (
        db.query(Question)
        .filter(Question.questionnaire_id == qid)
        .order_by(Question.position)
        .all()
    )
    
    return [
        QuestionOut(
            id=q.id,
            text=q.text,
            type=q.type,
            options=[opt.text for opt in q.options_list] if q.options_list else [],
            position=q.position
        )
        for q in questions
    ]

@router.post("/{qid}/questions", status_code=status.HTTP_200_OK)
def save_questions(
    qid: int,
    questions: list[QuestionCreate],
    confirm_delete: bool = Query(False),
    db: Session = Depends(get_db)
):
    get_questionnaire_or_404(qid, db)
    
    has_answers = (
        db.query(Answer)
        .join(Question)
        .filter(Question.questionnaire_id == qid)
        .count() > 0
    )

    if has_answers and not confirm_delete:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="ATENÇÃO: Este questionário já possui respostas coletadas. Para prosseguir, envie 'confirm_delete=true'."
        )

    subquery_questions = db.query(Question.id).filter(Question.questionnaire_id == qid)
    db.query(QuestionOption).filter(QuestionOption.question_id.in_(subquery_questions)).delete(synchronize_session=False)
    db.query(Question).filter(Question.questionnaire_id == qid).delete(synchronize_session=False)
    
    for q_data in questions:
        new_question = Question(
            questionnaire_id=qid,
            text=q_data.text,
            type=q_data.type,
            position=q_data.position
        )
        db.add(new_question)
        db.flush()
        
        if q_data.type == "multiple_choice" and q_data.options:
            for idx, opt_text in enumerate(q_data.options):
                db.add(QuestionOption(question_id=new_question.id, text=opt_text, position=idx))
    
    db.commit()
    return {"status": "ok", "message": f"{len(questions)} pergunta(s) salva(s)"}

@router.get("/{qid}/export/csv")
def export_structure_csv(qid: int, db: Session = Depends(get_db)):
    questionnaire = get_questionnaire_or_404(qid, db)
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_MINIMAL)
    writer.writerow(['Posicao', 'Tipo', 'Enunciado', 'Opcoes (separadas por |)'])
    
    questions = db.query(Question).filter(Question.questionnaire_id == qid).order_by(Question.position).all()
    for q in questions:
        options_str = "|".join([opt.text for opt in q.options_list]) if q.options_list else ""
        tipo_csv = "multipla" if q.type == QuestionType.MULTIPLE_CHOICE.value else "aberta"
        writer.writerow([q.position, tipo_csv, q.text, options_str])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue().encode('utf-8-sig')]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={questionnaire.name}_estrutura.csv"}
    )

@router.post("/import/csv", status_code=status.HTTP_201_CREATED)
async def import_structure_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'): raise HTTPException(400, "Arquivo deve ser CSV")
    content = await file.read()
    decoded = content.decode('utf-8-sig').splitlines()
    reader = csv.reader(decoded, delimiter=';')
    next(reader, None)
    
    new_q_name = f"Importado: {file.filename.replace('.csv', '')}"
    questionnaire = Questionnaire(name=new_q_name)
    db.add(questionnaire)
    db.commit()
    db.refresh(questionnaire)
    
    try:
        pos = 0
        for row in reader:
            if not row or len(row) < 3: continue
            tipo_raw, text_raw = row[1].lower().strip(), row[2].strip()
            options_raw = row[3].strip() if len(row) > 3 else ""
            q_type = QuestionType.MULTIPLE_CHOICE.value if "multipla" in tipo_raw else QuestionType.OPEN.value
            
            new_question = Question(questionnaire_id=questionnaire.id, text=text_raw, type=q_type, position=pos)
            db.add(new_question)
            db.flush()
            
            if q_type == QuestionType.MULTIPLE_CHOICE.value and options_raw:
                for idx, opt in enumerate(options_raw.split('|')):
                    if opt.strip(): db.add(QuestionOption(question_id=new_question.id, text=opt.strip(), position=idx))
            pos += 1
        db.commit()
        return {"status": "ok", "id": questionnaire.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Erro: {str(e)}")