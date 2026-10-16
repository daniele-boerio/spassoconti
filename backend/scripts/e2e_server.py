"""Backend per i test E2E (Playwright): SQLite usa e getta, schema da zero.

Non tocca nessun database vero. Lo avvia `frontend/playwright.config.ts`:

    python scripts/e2e_server.py  [porta, default 8001]

Il file SQLite viene ricreato a ogni avvio (`E2E_DB`, default e2e.sqlite3 nella
cartella del backend), così ogni giro di test parte vuoto. Lo schema si crea con
`Base.metadata.create_all`, come nei test pytest: le migrazioni Alembic sono
scritte per Postgres.
"""

import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

db_file = Path(os.getenv("E2E_DB", BACKEND / "e2e.sqlite3"))
db_file.unlink(missing_ok=True)

# Prima di importare l'app: database.py legge l'URL all'import.
os.environ["DATABASE_URL"] = f"sqlite:///{db_file.as_posix()}"
os.environ.setdefault("SECRET_KEY", "e2e-secret-key-che-non-serve-a-niente-di-vero")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ENVIRONMENT", "development")
# http://localhost: con Secure il browser scarterebbe il cookie di sessione.
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("RUN_SCHEDULER", "false")

import uvicorn  # noqa: E402

import models  # noqa: E402,F401  (registra le tabelle sul metadata)
from database import Base, engine  # noqa: E402
from rate_limit import limiter  # noqa: E402

Base.metadata.create_all(engine)
# Gli E2E fanno più login di fila dallo stesso IP: il rate limit li bloccherebbe.
limiter.enabled = False

if __name__ == "__main__":
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8001
    uvicorn.run("main:app", host="127.0.0.1", port=porta, log_level="warning")
