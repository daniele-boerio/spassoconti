import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Carica le variabili dal file .env
load_dotenv()

# Recupera i valori
user = os.getenv("DB_USER")
password = os.getenv("DB_PASSWORD")
host = os.getenv("DB_HOST")
port = os.getenv("DB_PORT")
database = os.getenv("DB_NAME")

# Componi l'URL in modo dinamico. DATABASE_URL, se c'è, vince: serve agli E2E
# (scripts/e2e_server.py, SQLite usa e getta). In produzione non è impostata.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL") or (
    f"postgresql://{user}:{password}@{host}:{port}/{database}"
)

# pool_pre_ping: dopo un riavvio di Postgres le connessioni nel pool sono morte, e
# senza il ping la prima richiesta su ciascuna andrebbe in 500.
engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
