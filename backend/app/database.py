import os
from venv import logger
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. Tenta pegar a URL do Neon das variáveis de ambiente.
# Se não existir (rodando local sem config), usa o SQLite como fallback.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sql_app.db")

# 2. Correção para o Render/Neon: O SQLAlchemy exige 'postgresql://', mas alguns serviços dão 'postgres://'
if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# --- DEBUG VISUAL VIA LOGGING (Mais robusto que print) ---
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    logger.warning("--- [SQLITE] MODO LOCAL: Usando arquivo .db ---")
else:
    logger.warning("--- [NEON] MODO NUVEM: Conectado ao PostgreSQL ---")
# ---------------------------------------------------------

# 3. Configuração do Engine
# O SQLite precisa do argumento "check_same_thread: False", mas o Postgres NÃO aceita isso.
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    # Configuração para PostgreSQL (Neon)
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()