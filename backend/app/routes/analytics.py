"""
app/routes/analytics.py
Endpoints para agregação, análise, exportação de dados e backup completo.
"""

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Query
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session, aliased, joinedload
from sqlalchemy import func
from app.dependencies import get_db, get_questionnaire_or_404
from app.models import Questionnaire, Question, Answer, QuestionType, Interview, QuestionOption
import csv
import io
import json
from datetime import datetime

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/{questionnaire_id}/report")
def get_report_data(
    questionnaire_id: int, 
    filter_question_id: int = Query(None),
    filter_option_index: int = Query(None),
    db: Session = Depends(get_db)
):
    questionnaire = get_questionnaire_or_404(questionnaire_id, db)
    
    # 1. Base Query para Entrevistas
    # CORREÇÃO: Adicionado .join(Answer) para garantir que só contamos entrevistas
    # que tenham pelo menos uma resposta registrada. Ignora a entrevista "em branco" do final.
    interviews_query = (
        db.query(Interview.id)
        .join(Answer, Answer.interview_id == Interview.id)
        .filter(Interview.questionnaire_id == questionnaire_id)
    )

    # 2. APLICAÇÃO DO FILTRO (Lógica de Coorte)
    if filter_question_id is not None and filter_option_index is not None:
        # Se houver filtro, precisamos garantir que o join de filtro seja específico
        # Como já fizemos join com Answer acima, usamos aliases ou filtros diretos.
        # Aqui, aplicamos o filtro na tabela Answer já joinada ou fazemos um novo filtro.
        # Para ser seguro e permitir filtro em pergunta X enquanto conta respostas gerais,
        # a melhor abordagem é filtrar ONDE existe UMA resposta que atenda ao critério.
        interviews_query = interviews_query.filter(
            Answer.question_id == filter_question_id,
            Answer.option_index == filter_option_index
        )
    
    # Obtemos os IDs válidos (Distinct é crucial pois uma entrevista tem várias respostas)
    valid_interview_ids_subquery = interviews_query.distinct()
    
    # Contagem total REAL (apenas com respostas)
    total_interviews = interviews_query.distinct().count()
    
    # 3. Carrega Perguntas
    questions = (
        db.query(Question)
        .options(joinedload(Question.options_list))
        .filter(Question.questionnaire_id == questionnaire_id)
        .order_by(Question.position)
        .all()
    )
    
    # 4. Busca Respostas (Filtradas pela lista de entrevistas válidas)
    all_answers = (
        db.query(Answer)
        .join(Question)
        .filter(Question.questionnaire_id == questionnaire_id)
        .filter(Answer.interview_id.in_(valid_interview_ids_subquery))
        .all()
    )
    
    answers_by_question = {}
    for ans in all_answers:
        if ans.question_id not in answers_by_question:
            answers_by_question[ans.question_id] = []
        answers_by_question[ans.question_id].append(ans)
    
    report = []
    
    for q in questions:
        q_data = {
            "id": q.id,
            "text": q.text,
            "type": q.type,
            "position": q.position,
            "total_answers": 0,
            "stats": {},
            "raw_answers": [],
            "options": [{"text": opt.text, "index": opt.position} for opt in q.options_list]
        }
        
        answers = answers_by_question.get(q.id, [])
        total_q_answers = len(answers)
        q_data["total_answers"] = total_q_answers
        
        if q.type == QuestionType.MULTIPLE_CHOICE.value:
            options_map = {opt.position: opt.text for opt in q.options_list}
            counts = {idx: 0 for idx in options_map.keys()}
            
            for ans in answers:
                if ans.option_index is not None and ans.option_index in counts:
                    counts[ans.option_index] += 1
                    label = options_map.get(ans.option_index, "")
                    q_data["raw_answers"].append(label)

            stats_list = []
            for idx in sorted(options_map.keys()):
                count = counts[idx]
                label = options_map.get(idx, f"Opção {idx+1}")
                percent = (count / total_q_answers * 100) if total_q_answers > 0 else 0
                stats_list.append({
                    "name": label,
                    "value": count,
                    "calculated_percent": round(percent, 1),
                    "original_index": idx
                })
            stats_list.sort(key=lambda x: x['original_index'])
            q_data["stats"] = stats_list
            
        elif q.type == QuestionType.OPEN.value:
            raw_list = []
            exact_group = {}
            normalized_group = {}
            
            for ans in answers:
                val = ans.text or "(Vazio)"
                raw_list.append(val)
                exact_group[val] = exact_group.get(val, 0) + 1
                norm_val = val.strip().lower()
                if norm_val not in normalized_group:
                    normalized_group[norm_val] = {"label": val.strip(), "count": 0}
                normalized_group[norm_val]["count"] += 1
            
            q_data["raw_answers"] = raw_list
            
            def format_group_stats(group_dict, use_inner_dict=False):
                result = []
                idx = 0
                for k, v in group_dict.items():
                    count = v["count"] if use_inner_dict else v
                    label = v["label"] if use_inner_dict else k
                    percent = (count / total_q_answers * 100) if total_q_answers > 0 else 0
                    result.append({"name": label, "value": count, "calculated_percent": round(percent, 1), "original_index": idx})
                    idx += 1
                return sorted(result, key=lambda x: x['value'], reverse=True)

            q_data["stats"] = {
                "exact": format_group_stats(exact_group, False),
                "normalized": format_group_stats(normalized_group, True)
            }
            
        report.append(q_data)
        
    return {
        "questionnaire": {"id": questionnaire.id, "name": questionnaire.name},
        "total_interviews": total_interviews,
        "questions": report
    }

# ==========================================
# CROSSTAB (Também corrigido para ignorar vazios)
# ==========================================

@router.get("/{questionnaire_id}/crosstab")
def get_crosstab_data(
    questionnaire_id: int,
    row_question_id: int,
    col_question_id: int,
    db: Session = Depends(get_db)
):
    q_row = db.query(Question).filter(Question.id == row_question_id, Question.questionnaire_id == questionnaire_id).first()
    q_col = db.query(Question).filter(Question.id == col_question_id, Question.questionnaire_id == questionnaire_id).first()
    
    if not q_row or not q_col:
        raise HTTPException(404, "Perguntas não encontradas.")

    row_options = {opt.position: opt.text for opt in q_row.options_list}
    col_options = {opt.position: opt.text for opt in q_col.options_list}
    
    AnsRow = aliased(Answer)
    AnsCol = aliased(Answer)
    
    # O Join interno já garante que só pegamos respostas existentes
    results = (
        db.query(
            AnsRow.option_index, 
            AnsCol.option_index, 
            func.count(AnsRow.interview_id)
        )
        .filter(AnsRow.question_id == row_question_id)
        .filter(AnsCol.question_id == col_question_id)
        .filter(AnsRow.interview_id == AnsCol.interview_id)
        .group_by(AnsRow.option_index, AnsCol.option_index)
        .all()
    )
    
    matrix = {}
    sorted_row_indices = sorted(row_options.keys())
    sorted_col_indices = sorted(col_options.keys())
    
    for r_idx in sorted_row_indices:
        r_label = row_options[r_idx]
        matrix[r_label] = {}
        for c_idx in sorted_col_indices:
            c_label = col_options[c_idx]
            matrix[r_label][c_label] = 0
            
    for r_idx, c_idx, count in results:
        if r_idx in row_options and c_idx in col_options:
            r_label = row_options[r_idx]
            c_label = col_options[c_idx]
            matrix[r_label][c_label] = count
            
    chart_data = []
    for r_label, cols in matrix.items():
        row_obj = {"name": r_label}
        row_obj.update(cols)
        chart_data.append(row_obj)
        
    return {
        "row_question": q_row.text,
        "col_question": q_col.text,
        "columns": [col_options[i] for i in sorted_col_indices],
        "data": chart_data
    }

# ==========================================
# EXPORTAÇÃO E BACKUP
# ==========================================

@router.get("/{qid}/export/data_csv")
def export_answers_csv(qid: int, db: Session = Depends(get_db)):
    questionnaire = get_questionnaire_or_404(qid, db)
    questions = db.query(Question).options(joinedload(Question.options_list)).filter(Question.questionnaire_id == qid).order_by(Question.position).all()
    
    # CORREÇÃO: Filtrar apenas entrevistas com respostas
    interviews = (
        db.query(Interview)
        .join(Answer) # Garante que tem resposta
        .options(joinedload(Interview.answers))
        .filter(Interview.questionnaire_id == qid)
        .order_by(Interview.number)
        .distinct()
        .all()
    )
    
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_MINIMAL)
    headers = ["Entrevista_ID"] + [f"P{q.position+1}_{q.text[:30]}" for q in questions]
    writer.writerow(headers)
    for interview in interviews:
        row = [interview.number]
        ans_map = {}
        for ans in interview.answers:
            val = ""
            if ans.text: val = ans.text
            elif ans.option_index is not None:
                q_obj = next((q for q in questions if q.id == ans.question_id), None)
                if q_obj: opt_text = next((o.text for o in q_obj.options_list if o.position == ans.option_index), str(ans.option_index)); val = opt_text
            ans_map[ans.question_id] = val
        for q in questions: row.append(ans_map.get(q.id, ""))
        writer.writerow(row)
    output.seek(0)
    return StreamingResponse(iter([output.getvalue().encode('utf-8-sig')]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={questionnaire.name}_respostas.csv"})

@router.get("/{qid}/export/backup_json")
def export_full_backup(qid: int, db: Session = Depends(get_db)):
    questionnaire = get_questionnaire_or_404(qid, db)
    questions = db.query(Question).options(joinedload(Question.options_list)).filter(Question.questionnaire_id == qid).order_by(Question.position).all()
    
    # CORREÇÃO: Filtrar apenas entrevistas com respostas no backup também
    interviews = (
        db.query(Interview)
        .join(Answer)
        .options(joinedload(Interview.answers))
        .filter(Interview.questionnaire_id == qid)
        .distinct()
        .all()
    )
    
    data = {
        "metadata": {"version": "1.0", "exported_at": str(datetime.now()), "type": "full_backup"},
        "questionnaire": {"name": questionnaire.name, "questions": []}, "interviews": []
    }
    for q in questions:
        data["questionnaire"]["questions"].append({"text": q.text, "type": q.type, "position": q.position, "options": [opt.text for opt in q.options_list]})
    for i in interviews:
        i_obj = {"number": i.number, "answers": []}
        for ans in i.answers:
            q_ref = next((q for q in questions if q.id == ans.question_id), None)
            if q_ref: i_obj["answers"].append({"question_position": q_ref.position, "text": ans.text, "option_index": ans.option_index})
        data["interviews"].append(i_obj)
    return JSONResponse(data)

@router.post("/import/backup_json")
async def import_full_backup(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.json'): raise HTTPException(400, "Arquivo deve ser JSON")
    try:
        content = await file.read()
        data = json.loads(content)
        q_name = data["questionnaire"]["name"] + " (Restaurado)"
        new_q = Questionnaire(name=q_name); db.add(new_q); db.commit(); db.refresh(new_q)
        position_to_id = {}
        for q_dict in data["questionnaire"]["questions"]:
            new_question = Question(questionnaire_id=new_q.id, text=q_dict["text"], type=q_dict["type"], position=q_dict["position"]); db.add(new_question); db.flush(); position_to_id[new_question.position] = new_question.id
            if "options" in q_dict:
                for idx, opt_text in enumerate(q_dict["options"]): db.add(QuestionOption(question_id=new_question.id, text=opt_text, position=idx))
        for i_dict in data["interviews"]:
            new_interview = Interview(questionnaire_id=new_q.id, number=i_dict["number"]); db.add(new_interview); db.flush()
            for ans_dict in i_dict["answers"]:
                q_pos = ans_dict["question_position"]
                if q_pos in position_to_id: db.add(Answer(interview_id=new_interview.id, question_id=position_to_id[q_pos], text=ans_dict.get("text"), option_index=ans_dict.get("option_index")))
        db.commit()
        return {"status": "ok", "message": "Backup restaurado com sucesso"}
    except Exception as e: db.rollback(); print(e); raise HTTPException(500, "Erro ao processar arquivo de backup.")