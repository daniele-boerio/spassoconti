import os
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from apscheduler.events import EVENT_JOB_MISSED
from apscheduler.schedulers.background import BackgroundScheduler
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

import models
from database import get_db
from rate_limit import limiter
from services import (
    task_snapshot_patrimonio,
    task_aggiornamento_prezzi,
    task_transazioni_ricorrenti,
    task_ricarica_automatica_conti,
    task_sync_bank_connectors,
    task_verifica_saldi,
    task_pulizia_refresh_token,
    task_notifiche_budget,
    task_promemoria_ricorrenze,
)
from routers import (
    auth,
    conti,
    categorie,
    transazioni,
    investimenti,
    user,
    sottocategorie,
    tag,
    debiti,
    ricorrenze,
    statistics,
    charts,
    bank_connectors,
    bank_proposals,
    open_banking,
    two_factor,
    notifiche,
)

logger = logging.getLogger(__name__)

# Lo scheduler gira IN-PROCESS: se l'app viene avviata con più worker
# (uvicorn/gunicorn --workers N) o scalata su più repliche, ogni processo ne
# avvia una copia e i job cron partono N volte. Il gate qui sotto lo tiene
# attivo di default (deploy a singolo worker) e va messo a "false" su tutte le
# repliche tranne una.
#
# Come rete di sicurezza, i job che scrivono soldi (ricorrenze, ricarica
# automatica) rileggono e bloccano ogni riga prima di toccarla (`FOR UPDATE SKIP
# LOCKED` su Postgres): anche con il gate sbagliato non registrano due volte la
# stessa occorrenza. Gli altri job sono idempotenti (snapshot, prezzi, verifica
# saldi) o limitati dal provider (sync bancaria), quindi duplicarli spreca ma
# non corrompe.
RUN_SCHEDULER = os.getenv("RUN_SCHEDULER", "true").lower() in ("1", "true", "yes")

# misfire_grace_time: con il default (1 s) un job che cade mentre il container è
# in deploy o riavvio viene saltato senza dirlo a nessuno; così parte appena lo
# scheduler riprende, entro un'ora. coalesce: se ne ha persi più d'uno, uno solo.
scheduler = BackgroundScheduler(
    job_defaults={"misfire_grace_time": 3600, "coalesce": True}
)


def _job_saltato(event):
    logger.error("Job %s saltato (scheduler fermo all'orario previsto)", event.job_id)


scheduler.add_listener(_job_saltato, EVENT_JOB_MISSED)
scheduler.add_job(task_aggiornamento_prezzi, "cron", hour=2, minute=0)
scheduler.add_job(task_transazioni_ricorrenti, "cron", hour=3, minute=0)
# Ogni notte riscrive la foto del mese in corso: quella che resta a fine mese
# è l'ultima scattata, ed è quella che serve al confronto.
scheduler.add_job(task_snapshot_patrimonio, "cron", hour=1, minute=30)
scheduler.add_job(task_ricarica_automatica_conti, "cron", hour=4, minute=0)
# Dopo ricorrenze e ricariche: controlla che ogni saldo torni con i movimenti.
scheduler.add_job(task_verifica_saldi, "cron", hour=4, minute=30)
# I refresh token scaduti da più di una settimana: nessuno li toglieva.
scheduler.add_job(task_pulizia_refresh_token, "cron", hour=5, minute=0)
# Ogni 6 ore (4 volte/giorno): le API AIS (PSD2) limitano gli accessi non
# presidiati, quindi una sync oraria genera 429 "Too Many Requests".
scheduler.add_job(task_sync_bank_connectors, "cron", hour="*/6")
# Notifiche push solo di giorno (ore UTC: in Italia 7/8 - 21/22): un avviso di
# budget alle 3 di notte sveglia e basta.
scheduler.add_job(task_notifiche_budget, "cron", hour="6-20", minute="*/30")
scheduler.add_job(task_promemoria_ricorrenze, "cron", hour=7, minute=0)


VARIABILI_OBBLIGATORIE = (
    "DB_USER",
    "DB_PASSWORD",
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "SECRET_KEY",
    "ALGORITHM",
    "FRONTEND_URL",
)
ALGORITMI_JWT = {"HS256", "HS384", "HS512"}


def verifica_configurazione() -> None:
    """In produzione l'app non parte con la configurazione incompleta.

    Senza questo controllo una variabile mancante non si vedeva all'avvio: il
    processo partiva, /api/health era verde, e il primo login (SECRET_KEY) o la
    prima query (DB_*) andavano in 500. Fermarsi qui fa fallire il deploy, che
    è il posto giusto per accorgersene. L'SMTP è facoltativo: senza, il reset
    password non manda mail, e lo si dice forte nei log.
    """
    mancanti = [nome for nome in VARIABILI_OBBLIGATORIE if not os.getenv(nome)]
    if mancanti:
        raise RuntimeError(
            "Configurazione incompleta, mancano: " + ", ".join(mancanti)
        )
    if os.getenv("ALGORITHM") not in ALGORITMI_JWT:
        raise RuntimeError(
            f"ALGORITHM deve essere uno di {sorted(ALGORITMI_JWT)}"
        )
    if len(os.getenv("SECRET_KEY", "")) < 32:
        logger.warning("SECRET_KEY corta (< 32 caratteri): meglio rigenerarla")
    if not all(os.getenv(n) for n in ("SMTP_SERVER", "SMTP_USERNAME", "SMTP_PASSWORD")):
        logger.error("SMTP non configurato: il reset password non invierà email")
    if not (os.getenv("VAPID_PUBLIC_KEY") and os.getenv("VAPID_PRIVATE_KEY")):
        logger.warning(
            "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY mancanti: notifiche push spente "
            "(chiavi da scripts/genera_chiavi_vapid.py)"
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    if IS_PRODUCTION:
        verifica_configurazione()
    if RUN_SCHEDULER:
        scheduler.start()
        logger.info("Scheduler avviato su questo processo")
    else:
        logger.info("Scheduler disabilitato su questo processo (RUN_SCHEDULER=false)")
    yield
    # Shutdown: si ferma ciò che sta girando, senza ricontrollare il flag (che
    # nel frattempo può essere cambiato, es. nei test).
    if scheduler.running:
        scheduler.shutdown(wait=False)


# In produzione la documentazione interattiva non va esposta: /docs e /openapi.json
# regalano a chiunque la mappa completa degli endpoint. Il contratto resta comunque
# generabile in locale (ENVIRONMENT != "production").
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development").lower() == "production"

# FE e BE stanno sullo stesso dominio: nginx (container frontend) serve la SPA e
# gira al backend tutto ciò che inizia per /api, senza toccare il path. Quindi
# ogni endpoint vive sotto questo prefisso.
API_PREFIX = "/api"

app = FastAPI(
    title="Calcolatore Spese API",
    servers=[{"url": "/", "description": "Default"}],
    lifespan=lifespan,
    # Sotto /api come tutto il resto: fuori da /api nginx serve il frontend.
    docs_url=None if IS_PRODUCTION else f"{API_PREFIX}/docs",
    redoc_url=None if IS_PRODUCTION else f"{API_PREFIX}/redoc",
    openapi_url=None if IS_PRODUCTION else f"{API_PREFIX}/openapi.json",
)

# Rate limiting: senza, /login è aperto al brute force e /auth/forgot-password
# può essere usato per inondare di email una casella. I limiti per-endpoint sono
# dichiarati con @limiter.limit(...) sui router.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Un'eccezione non gestita, senza questo blocco, viene raccolta dal
# ServerErrorMiddleware di Starlette: risposta "Internal Server Error" in text/plain
# e — soprattutto — SENZA header CORS, perché quel middleware sta più in alto di
# CORSMiddleware. Il browser scarta la risposta, il frontend non legge nulla e può
# solo dire "errore di connessione", perdendo la causa vera.
#
# Qui l'errore diventa un JSON con un `detail` leggibile e un `error_id` che compare
# identico nei log: quando un utente segnala un errore, quel codice porta dritto alla
# traceback corrispondente.
#
# ORDINE IMPORTANTE: questo middleware va registrato PRIMA di CORSMiddleware. Starlette
# mette per ultimo il primo registrato, quindi così CORS resta più esterno e aggiunge i
# suoi header anche alla risposta d'errore.
@app.middleware("http")
async def handle_unexpected_errors(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:
        error_id = uuid.uuid4().hex[:8]
        logger.exception(
            "Errore non gestito [%s] su %s %s",
            error_id,
            request.method,
            request.url.path,
        )
        return JSONResponse(
            status_code=500,
            content={
                # Messaggio in inglese come il resto dei `detail` dei router: la
                # traduzione per l'utente la fa il frontend (i18n).
                "detail": (
                    f"Unexpected server error on {request.method} "
                    f"{request.url.path} (reference {error_id})"
                ),
                "error_id": error_id,
            },
        )


# Middleware CORS (rimane qui)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://conti.spassocasa.it", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrazione dei Router, tutti sotto API_PREFIX
api = APIRouter(prefix=API_PREFIX)
api.include_router(user.router)  # Gli endpoint di user (login/register)
api.include_router(conti.router)  # Gli endpoint dei conti
api.include_router(categorie.router)  # Categorie
api.include_router(sottocategorie.router)  # Sottocategorie
api.include_router(transazioni.router)  # Transazioni
api.include_router(investimenti.router)  # Investimenti
api.include_router(tag.router)  # Tag
api.include_router(ricorrenze.router)  # Ricorrenze
api.include_router(statistics.router)  # Statistiche
api.include_router(charts.router)  # API Grafici
api.include_router(bank_connectors.router)  # Connettore bancario
api.include_router(bank_proposals.router)  # Proposte di transazione (tutte le pending)
api.include_router(open_banking.router)  # Open Banking (GoCardless) requisition flow
api.include_router(debiti.router)  # Debiti
api.include_router(auth.router)  # Endpoint per forgot-password e reset-password
api.include_router(two_factor.router)  # Verifica in due passaggi (/auth/2fa)
api.include_router(notifiche.router)  # Notifiche push


# Il healthcheck del container. Tocca il database apposta: un BE che risponde ma
# non raggiunge Postgres non serve a niente, e deve risultare unhealthy (così un
# deploy con le DB_* sbagliate torna indietro da solo invece di andare in 500).
@api.get("/health", include_in_schema=False)
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Healthcheck: database non raggiungibile")
        return JSONResponse(
            status_code=503, content={"status": "error", "database": "unreachable"}
        )
    return {"status": "ok", "database": "ok"}


# Ogni quanto deve aver girato ciascun job (con margine sull'orario del cron).
# Un job mai partito da quando esiste `job_runs` è "in attesa", non un guasto.
FRESCHEZZA_JOB = {
    "snapshot_patrimonio": timedelta(hours=26),
    "aggiornamento_prezzi": timedelta(hours=26),
    "transazioni_ricorrenti": timedelta(hours=26),
    "ricarica_automatica": timedelta(hours=26),
    "verifica_saldi": timedelta(hours=26),
    "pulizia_refresh_token": timedelta(hours=26),
    "sync_bank_connectors": timedelta(hours=7),
    # Ogni mezz'ora dalle 6 alle 20:30 UTC: di notte il buco più lungo è ~10 ore.
    "notifiche_budget": timedelta(hours=11),
    "promemoria_ricorrenze": timedelta(hours=26),
}


def _utc(dt: datetime) -> datetime:
    # SQLite (test) restituisce datetime senza fuso: sono comunque UTC.
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# Lo stato dei job notturni, separato da /health: quello è il healthcheck del
# container, e un saldo sfasato non deve far ritenere "unhealthy" (e quindi
# riavviare o bloccare un deploy) un'app che funziona. Questo lo controlla il
# monitor su GitHub ogni mattina e manda la mail se risponde 503.
# Pubblico ma senza dati: solo nomi dei job, esiti e conteggi.
@api.get("/health/jobs", include_in_schema=False)
def health_jobs(db: Session = Depends(get_db)):
    if not RUN_SCHEDULER:
        return {"status": "ok", "scheduler": "disabled", "jobs": {}}

    adesso = datetime.now(timezone.utc)
    righe = {r.nome: r for r in db.query(models.JobRun).all()}
    jobs, problemi = {}, []
    for nome, freschezza in FRESCHEZZA_JOB.items():
        riga = righe.get(nome)
        if riga is None:
            jobs[nome] = {"esito": "in_attesa"}
            continue
        stato = {
            "esito": riga.esito,
            "ultimo_avvio": _utc(riga.ultimo_avvio).isoformat(),
            "errori": riga.errori,
        }
        if riga.problemi is not None:
            stato["problemi"] = riga.problemi
        if riga.esito != "ok":
            problemi.append(f"{nome}: {riga.esito}")
        if adesso - _utc(riga.ultimo_avvio) > freschezza:
            stato["in_ritardo"] = True
            problemi.append(f"{nome}: in ritardo")
        if riga.problemi:
            problemi.append(f"{nome}: {riga.problemi} da controllare")
        jobs[nome] = stato

    corpo = {"status": "error" if problemi else "ok", "problemi": problemi, "jobs": jobs}
    return JSONResponse(status_code=503 if problemi else 200, content=corpo)


app.include_router(api)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
