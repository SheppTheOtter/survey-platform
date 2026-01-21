import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger("uvicorn")

# 1. Recupera a URL do ambiente (Nuvem) ou usa local (SQLite)
# Voltamos para o padrão 'sql_app.db', mas se quiser manter o histórico local, 
# pode mudar o final para 'survey.db'
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sql_app.db")

# 2. Correção para o Render/Neon (postgres:// -> postgresql://)
if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Log para você saber onde está conectando
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    logger.warning("--- [AMBIENTE LOCAL] Usando SQLite (.db) ---")
else:
    logger.warning("--- [AMBIENTE NUVEM] Conectado ao PostgreSQL (Neon) ---")

# 3. Configuração do Engine
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()