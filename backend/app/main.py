"""
app/main.py
Arquivo principal da aplicação FastAPI
"""

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database import Base, engine
from app.dependencies import get_db
from app.routes.questionnaires import router as questionnaires_router
from app.routes.collection import router as collection_router
from app.models import Questionnaire, Interview, Answer
from app.routes.analytics import router as analytics_router

# Cria todas as tabelas
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Survey API",
    description="API para criação e coleta de questionários",
    version="1.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(questionnaires_router)
app.include_router(collection_router)
app.include_router(analytics_router)

@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "version": "1.1.0"}

@app.get("/stats", tags=["Stats"])
def get_stats(db: Session = Depends(get_db)):
    """
    Retorna estatísticas básicas.
    Refatorado: Agora usa injeção de dependência correta (Depends).
    """
    total_questionnaires = db.query(Questionnaire).count()
    total_interviews = db.query(Interview).count()
    total_answers = db.query(Answer).count()
    
    return {
        "total_questionnaires": total_questionnaires,
        "total_interviews": total_interviews,
        "total_answers": total_answers
    }