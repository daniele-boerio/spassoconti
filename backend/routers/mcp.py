"""Server MCP di SpassoConti: le proprie spese chieste a un assistente (Claude).

Due pezzi, entrambi qui:

1. **OAuth 2.1** minimale, quello che un client MCP si aspetta (scoperta via
   `/.well-known`, registrazione dinamica del client, PKCE S256). L'utente si
   autorizza con le sue credenziali di SpassoConti (più il codice della 2FA, se
   l'ha attiva) in una pagina servita dal BE. Tutto è *stateless*: client, codici
   e token sono blob firmati in HMAC con una chiave derivata da SECRET_KEY, quindi
   non serve nessuna tabella e i token sopravvivono ai riavvii. Ogni token porta
   `token_version`: cambio password, "esci ovunque" o ban lo invalidano subito,
   come per le sessioni dell'app.

2. **Endpoint MCP** (`POST /api/mcp`, Streamable HTTP senza sessione, risposte
   JSON) con strumenti di **sola lettura**. Ogni query filtra per l'utente del
   token e scarta conti e movimenti cancellati: le regole sono le stesse dei
   router dell'app, e gli aggregati usano gli stessi helper delle statistiche
   (`importo_effettivo`, `get_calculated_amount`) così i numeri coincidono.

La scoperta OAuth (`/.well-known/oauth-*`) sta alla radice del dominio, fuori da
/api: nginx la inoltra al BE con un blocco dedicato (frontend/nginx.conf).
"""

import base64
import calendar
import hashlib
import hmac
import html
import json
import logging
import os
import secrets
import time
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Callable, Optional
from urllib.parse import urlencode, urlparse

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from sqlalchemy import extract, func, or_
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

import auth
from database import get_db
from models import (
    Categoria,
    Conto,
    Ricorrenza,
    Sottocategoria,
    Tag,
    Transazione,
    User,
)
from rate_limit import limiter
from routers.statistics import get_calculated_amount
from services import importo_effettivo, stato_quadrature, verifica_saldi

logger = logging.getLogger(__name__)

router = APIRouter(tags=["MCP"])
# Le rotte di scoperta OAuth vanno alla radice dell'app, non sotto /api.
well_known = APIRouter(tags=["MCP"], include_in_schema=False)

MCP_PATH = "/api/mcp"
OAUTH_PATH = "/api/mcp/oauth"

ACCESS_TTL = 60 * 60  # 1 ora
REFRESH_TTL = 60 * 60 * 24 * 30  # 30 giorni: poi si rifà l'accesso
CODE_TTL = 5 * 60
LOGIN_TTL = 15 * 60

PROTOCOL_VERSIONS = ("2025-06-18", "2025-03-26", "2024-11-05")


# --- Firma dei blob -----------------------------------------------------------


def _chiave() -> bytes:
    # Letta a ogni uso e non all'import: i test cambiano SECRET_KEY con monkeypatch.
    return hashlib.sha256(
        ("spassoconti-mcp:" + (os.getenv("SECRET_KEY") or "")).encode()
    ).digest()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def _mac(data: str) -> str:
    return _b64(hmac.new(_chiave(), data.encode(), hashlib.sha256).digest())


def firma(payload: dict) -> str:
    corpo = _b64(json.dumps(payload, separators=(",", ":")).encode())
    return f"{corpo}.{_mac(corpo)}"


def verifica(token: str, tipo: str) -> Optional[dict]:
    """Il payload se la firma torna, il tipo è quello atteso e non è scaduto."""
    parti = (token or "").split(".")
    if len(parti) != 2:
        return None
    corpo, sig = parti
    if not hmac.compare_digest(_mac(corpo), sig):
        return None
    try:
        payload = json.loads(_unb64(corpo))
    except ValueError:
        return None
    if not isinstance(payload, dict) or payload.get("t") != tipo:
        return None
    if payload.get("exp") is not None and payload["exp"] < time.time():
        return None
    return payload


# --- URL pubblici -------------------------------------------------------------


def base_url(request: Request) -> str:
    """L'origine pubblica dell'app (https://conti.spassocasa.it in produzione).

    FRONTEND_URL è già nel compose: è il dominio che Traefik manda a nginx, e
    nginx gira /api e /.well-known a noi. Senza, si usa quello della richiesta.
    """
    return (os.getenv("FRONTEND_URL") or str(request.base_url)).rstrip("/")


def _resource_metadata_url(request: Request) -> str:
    return f"{base_url(request)}/.well-known/oauth-protected-resource{MCP_PATH}"


def _metadata_risorsa(request: Request) -> dict:
    base = base_url(request)
    return {
        "resource": base + MCP_PATH,
        "authorization_servers": [base],
        "scopes_supported": ["spese"],
        "bearer_methods_supported": ["header"],
        "resource_name": "SpassoConti",
    }


def _metadata_server(request: Request) -> dict:
    base = base_url(request)
    return {
        "issuer": base,
        "authorization_endpoint": base + OAUTH_PATH + "/authorize",
        "token_endpoint": base + OAUTH_PATH + "/token",
        "registration_endpoint": base + OAUTH_PATH + "/register",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": [
            "client_secret_post",
            "client_secret_basic",
            "none",
        ],
        "scopes_supported": ["spese"],
    }


@well_known.get("/.well-known/oauth-protected-resource")
@well_known.get("/.well-known/oauth-protected-resource" + MCP_PATH)
def oauth_protected_resource(request: Request):
    return _metadata_risorsa(request)


@well_known.get("/.well-known/oauth-authorization-server")
@well_known.get("/.well-known/oauth-authorization-server" + MCP_PATH)
@well_known.get("/.well-known/openid-configuration")
def oauth_authorization_server(request: Request):
    return _metadata_server(request)


# --- Client (registrazione dinamica, senza stato) -----------------------------


def _oauth_error(errore: str, descrizione: str, status: int = 400) -> JSONResponse:
    return JSONResponse(
        {"error": errore, "error_description": descrizione},
        status_code=status,
        headers={"Cache-Control": "no-store"},
    )


def _redirect_ammesso(uri: str) -> bool:
    """https ovunque, http solo verso questo computer (client MCP locali)."""
    try:
        parsed = urlparse(uri)
    except ValueError:
        return False
    if parsed.fragment or not parsed.netloc:
        return False
    if parsed.scheme == "https":
        return True
    return parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1", "::1")


def _segreto_client(client_id: str) -> str:
    return _mac("secret:" + client_id)


def leggi_client(client_id: str) -> Optional[dict]:
    return verifica(client_id, "client")


@router.post(OAUTH_PATH.removeprefix("/api") + "/register", include_in_schema=False)
async def oauth_register(request: Request):
    try:
        body = await request.json()
    except ValueError:
        return _oauth_error("invalid_client_metadata", "JSON non valido")
    if not isinstance(body, dict):
        return _oauth_error("invalid_client_metadata", "JSON non valido")

    redirect_uris = body.get("redirect_uris")
    if (
        not isinstance(redirect_uris, list)
        or not redirect_uris
        or len(redirect_uris) > 10
        or not all(isinstance(u, str) and _redirect_ammesso(u) for u in redirect_uris)
    ):
        return _oauth_error(
            "invalid_redirect_uri", "redirect_uris deve essere una lista di URL https"
        )

    metodo = body.get("token_endpoint_auth_method") or "client_secret_post"
    if metodo not in ("client_secret_post", "client_secret_basic", "none"):
        return _oauth_error("invalid_client_metadata", "metodo di autenticazione non supportato")

    nome = str(body.get("client_name") or "")[:100] or None
    emesso = int(time.time())
    client_id = firma(
        {"t": "client", "r": redirect_uris, "n": nome, "a": metodo, "iat": emesso}
    )
    risposta = {
        "client_id": client_id,
        "client_id_issued_at": emesso,
        "client_name": nome,
        "redirect_uris": redirect_uris,
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": metodo,
    }
    if metodo != "none":
        risposta["client_secret"] = _segreto_client(client_id)
        risposta["client_secret_expires_at"] = 0
    return JSONResponse(risposta, status_code=201, headers={"Cache-Control": "no-store"})


# --- Autorizzazione: pagina di accesso ----------------------------------------


def _pagina_accesso(
    login: str, client: str, redirect_uri: str, errore: Optional[str] = None
) -> HTMLResponse:
    esc = html.escape
    origine = urlparse(redirect_uri)
    # form-action vale anche per il redirect che segue il POST: senza l'origine
    # del client, Chrome bloccherebbe il ritorno a claude.ai.
    destinazione = f"{origine.scheme}://{origine.netloc}"
    pagina = f"""<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SpassoConti – Collega un assistente</title>
<style>
  :root{{color-scheme:light dark;--bg:#f6f5f2;--card:#fff;--fg:#1d1d1b;--muted:#6b6a66;--line:#d9d7d1;--accent:#3d6b4f;--err:#b3261e}}
  @media (prefers-color-scheme:dark){{:root{{--bg:#151514;--card:#1f1f1d;--fg:#ecebe7;--muted:#a3a19b;--line:#3a3936;--accent:#7fb592;--err:#f2b8b5}}}}
  *{{box-sizing:border-box}}
  body{{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;background:var(--bg);color:var(--fg);font:16px/1.45 system-ui,-apple-system,sans-serif}}
  form{{width:100%;max-width:380px;display:grid;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:24px}}
  h1{{margin:0;font-size:1.35rem}}
  p{{margin:0;color:var(--muted);font-size:.95rem}}
  label{{display:grid;gap:4px;font-size:.9rem}}
  input{{font:inherit;padding:10px 12px;border-radius:9px;border:1px solid var(--line);background:transparent;color:inherit}}
  button{{font:inherit;padding:11px;border:0;border-radius:9px;background:var(--accent);color:#fff;font-weight:600;cursor:pointer}}
  .err{{color:var(--err)}}
  .hint{{font-size:.82rem}}
</style></head><body>
<form method="post" action="authorize">
  <h1>SpassoConti</h1>
  <p><strong>{esc(client)}</strong> chiede di leggere i tuoi conti e i tuoi movimenti. Non potrà modificare nulla.</p>
  {f'<p class="err" role="alert">{esc(errore)}</p>' if errore else ''}
  <input type="hidden" name="login" value="{esc(login)}">
  <label>Username o email<input name="username" autocomplete="username" required autofocus></label>
  <label>Password<input type="password" name="password" autocomplete="current-password" required></label>
  <label>Codice di verifica<input name="codice" inputmode="numeric" autocomplete="one-time-code" placeholder="Solo se hai la verifica in due passaggi"></label>
  <button type="submit">Autorizza</button>
  <p class="hint">Puoi revocare l'accesso in qualsiasi momento con "Esci da tutti i dispositivi" nelle impostazioni dell'app.</p>
</form></body></html>"""
    return HTMLResponse(
        pagina,
        status_code=401 if errore else 200,
        headers={
            "Content-Security-Policy": (
                "default-src 'none'; style-src 'unsafe-inline'; "
                f"form-action 'self' {destinazione}; frame-ancestors 'none'"
            ),
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
        },
    )


def _redirect_errore(redirect_uri: str, errore: str, state: Optional[str]) -> RedirectResponse:
    query = {"error": errore}
    if state:
        query["state"] = state
    sep = "&" if "?" in redirect_uri else "?"
    return RedirectResponse(f"{redirect_uri}{sep}{urlencode(query)}", status_code=302)


@router.get(OAUTH_PATH.removeprefix("/api") + "/authorize", include_in_schema=False)
def oauth_authorize(request: Request):
    q = request.query_params
    client = leggi_client(q.get("client_id", ""))
    redirect_uri = q.get("redirect_uri", "")
    # Con client o redirect sbagliati non si rimanda da nessuna parte: si
    # finirebbe per inviare un codice a un indirizzo non registrato.
    if not client:
        return HTMLResponse("Client non registrato. Ricollega il connettore.", status_code=400)
    if not redirect_uri and len(client["r"]) == 1:
        redirect_uri = client["r"][0]
    if redirect_uri not in client["r"]:
        return HTMLResponse("redirect_uri non registrato per questo client.", status_code=400)

    state = q.get("state")
    if q.get("response_type") != "code":
        return _redirect_errore(redirect_uri, "unsupported_response_type", state)
    challenge = q.get("code_challenge", "")
    if not challenge or q.get("code_challenge_method", "S256") != "S256":
        return _redirect_errore(redirect_uri, "invalid_request", state)

    login = firma(
        {
            "t": "login",
            "c": q["client_id"],
            "r": redirect_uri,
            "ch": challenge,
            "s": state,
            "res": q.get("resource"),
            "exp": int(time.time()) + LOGIN_TTL,
        }
    )
    return _pagina_accesso(login, client.get("n") or "Un assistente", redirect_uri)


@router.post(OAUTH_PATH.removeprefix("/api") + "/authorize", include_in_schema=False)
@limiter.limit("10/minute;50/hour")
async def oauth_authorize_post(request: Request, db: Session = Depends(get_db)):
    # Il form si legge in async; bcrypt e le query girano nel threadpool, come
    # negli altri router (sincroni), per non bloccare l'event loop.
    form = dict(await request.form())
    return await run_in_threadpool(_autorizza, db, form)


def _autorizza(db: Session, form: dict) -> Response:
    login_token = str(form.get("login", ""))
    login = verifica(login_token, "login")
    if not login:
        return HTMLResponse(
            "Richiesta di accesso scaduta. Torna all'assistente e ricollega il connettore.",
            status_code=400,
        )
    client = leggi_client(login["c"])
    if not client or login["r"] not in client["r"]:
        return HTMLResponse("Client non valido.", status_code=400)
    nome_client = client.get("n") or "Un assistente"

    def rifiuta(messaggio: str) -> HTMLResponse:
        return _pagina_accesso(login_token, nome_client, login["r"], messaggio)

    identificativo = str(form.get("username", "")).strip().lower()
    password = str(form.get("password", ""))
    codice = str(form.get("codice", "")).strip()
    if not identificativo or not password:
        return rifiuta("Scrivi username (o email) e password.")

    # Stesse regole di POST /login: utente inesistente e password sbagliata non
    # si distinguono, né nel messaggio né nel tempo (bcrypt su un hash finto).
    user = (
        db.query(User)
        .filter(or_(User.username == identificativo, User.email == identificativo))
        .first()
    )
    if user:
        password_ok = auth.verify_password(password, user.hashed_password)
    else:
        from routers.user import _DUMMY_PASSWORD_HASH

        auth.verify_password(password, _DUMMY_PASSWORD_HASH)
        password_ok = False
    if not password_ok:
        return rifiuta("Credenziali non valide.")
    if user.banned_at is not None:
        return rifiuta("Questo account è stato disattivato dall'amministratore.")

    if user.totp_enabled:
        if not codice:
            return rifiuta("Hai la verifica in due passaggi: scrivi anche il codice.")
        user = db.query(User).filter(User.id == user.id).with_for_update().first()
        if not auth.verifica_secondo_fattore(db, user, codice):
            db.rollback()
            return rifiuta("Codice di verifica errato.")
        # Salva totp_last_step (o il codice di recupero bruciato): lo stesso
        # codice non vale due volte.
        db.commit()

    codice_oauth = firma(
        {
            "t": "code",
            "c": login["c"],
            "r": login["r"],
            "ch": login["ch"],
            "res": login.get("res"),
            "u": user.id,
            "v": user.token_version,
            "j": secrets.token_urlsafe(12),
            "exp": int(time.time()) + CODE_TTL,
        }
    )
    query = {"code": codice_oauth}
    if login.get("s"):
        query["state"] = login["s"]
    sep = "&" if "?" in login["r"] else "?"
    logger.info("MCP: accesso autorizzato per l'utente %s", user.id)
    return RedirectResponse(f"{login['r']}{sep}{urlencode(query)}", status_code=302)


# --- Token ------------------------------------------------------------------

# Codici già scambiati: un codice vale una volta sola. In memoria basta, il BE
# gira con un processo solo (vedi RUN_SCHEDULER) e i codici durano 5 minuti.
_codici_usati: dict[str, float] = {}


def _emetti_token(client_id: str, user: User, resource: Optional[str]) -> JSONResponse:
    adesso = int(time.time())
    base = {"c": client_id, "u": user.id, "v": user.token_version, "res": resource}
    return JSONResponse(
        {
            "access_token": firma({**base, "t": "access", "exp": adesso + ACCESS_TTL}),
            "token_type": "Bearer",
            "expires_in": ACCESS_TTL,
            "refresh_token": firma(
                {**base, "t": "refresh", "exp": adesso + REFRESH_TTL, "j": secrets.token_urlsafe(8)}
            ),
            "scope": "spese",
        },
        headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
    )


def _utente_valido(db: Session, payload: dict) -> Optional[User]:
    user = db.query(User).filter(User.id == payload.get("u")).first()
    if not user or user.banned_at is not None or user.token_version != payload.get("v"):
        return None
    return user


@router.post(OAUTH_PATH.removeprefix("/api") + "/token", include_in_schema=False)
async def oauth_token(request: Request, db: Session = Depends(get_db)):
    form = dict(await request.form())
    return await run_in_threadpool(_scambia, db, form, request.headers.get("authorization", ""))


def _scambia(db: Session, form: dict, header: str) -> Response:
    client_id = str(form.get("client_id", ""))
    client_secret = form.get("client_secret")

    if header.lower().startswith("basic "):
        try:
            client_id, client_secret = (
                base64.b64decode(header[6:]).decode().split(":", 1)
            )
        except (ValueError, UnicodeDecodeError):
            return _oauth_error("invalid_client", "Autenticazione del client non valida", 401)
        from urllib.parse import unquote

        client_id, client_secret = unquote(client_id), unquote(client_secret)

    client = leggi_client(client_id)
    if not client:
        return _oauth_error("invalid_client", "Client sconosciuto", 401)
    if client.get("a") != "none" and not hmac.compare_digest(
        str(client_secret or ""), _segreto_client(client_id)
    ):
        return _oauth_error("invalid_client", "client_secret errato", 401)

    grant = form.get("grant_type")
    if grant == "authorization_code":
        codice = verifica(str(form.get("code", "")), "code")
        if not codice or codice["c"] != client_id:
            return _oauth_error("invalid_grant", "Codice non valido o scaduto")
        redirect_uri = form.get("redirect_uri")
        if redirect_uri and redirect_uri != codice["r"]:
            return _oauth_error("invalid_grant", "redirect_uri diverso da quello autorizzato")
        verifier = str(form.get("code_verifier", ""))
        atteso = _b64(hashlib.sha256(verifier.encode()).digest())
        if not verifier or not hmac.compare_digest(atteso, codice["ch"]):
            return _oauth_error("invalid_grant", "code_verifier non valido")

        adesso = time.time()
        for j, scade in list(_codici_usati.items()):
            if scade < adesso:
                del _codici_usati[j]
        if codice["j"] in _codici_usati:
            return _oauth_error("invalid_grant", "Codice già usato")
        _codici_usati[codice["j"]] = codice["exp"]

        user = _utente_valido(db, codice)
        if not user:
            return _oauth_error("invalid_grant", "Account non più valido")
        return _emetti_token(client_id, user, codice.get("res"))

    if grant == "refresh_token":
        refresh = verifica(str(form.get("refresh_token", "")), "refresh")
        if not refresh or refresh["c"] != client_id:
            return _oauth_error("invalid_grant", "Refresh token non valido o scaduto")
        user = _utente_valido(db, refresh)
        if not user:
            return _oauth_error("invalid_grant", "Sessione revocata: rifai l'accesso")
        return _emetti_token(client_id, user, refresh.get("res"))

    return _oauth_error("unsupported_grant_type", "grant_type non supportato")


# --- Strumenti --------------------------------------------------------------


def _d(valore: Any) -> Optional[str]:
    """Decimal/float/None → stringa a due decimali (i soldi viaggiano come testo)."""
    if valore is None:
        return None
    return str(Decimal(str(valore)).quantize(Decimal("0.01")))


def _data(valore: Any, nome: str) -> Optional[date]:
    if valore in (None, ""):
        return None
    try:
        return date.fromisoformat(str(valore))
    except ValueError:
        raise ValueError(f"{nome} deve essere una data AAAA-MM-GG")


def _periodo(args: dict, default_giorni: Optional[int] = None) -> tuple[date, date]:
    """data_inizio/data_fine (inclusa). Default: il mese corrente, o gli ultimi N giorni."""
    oggi = date.today()
    inizio = _data(args.get("data_inizio"), "data_inizio")
    fine = _data(args.get("data_fine"), "data_fine")
    if inizio is None:
        inizio = (
            oggi - timedelta(days=default_giorni)
            if default_giorni
            else oggi.replace(day=1)
        )
    if fine is None:
        fine = oggi if default_giorni else inizio.replace(
            day=calendar.monthrange(inizio.year, inizio.month)[1]
        )
    if fine < inizio:
        raise ValueError("data_fine precede data_inizio")
    return inizio, fine


def _movimenti_utente(db: Session, user_id: int):
    return db.query(Transazione).filter(
        Transazione.user_id == user_id, Transazione.deleted_at.is_(None)
    )


def _per_nome(db: Session, model, user_id: int, nome: str, extra=()):
    """L'id di una categoria/tag/conto per nome, senza badare alle maiuscole."""
    filtri = [model.user_id == user_id, func.lower(model.nome) == nome.strip().lower(), *extra]
    riga = db.query(model).filter(*filtri).first()
    if riga is None:
        raise ValueError(f"'{nome}' non trovato: usa lo strumento categorie per i nomi esatti")
    return riga


def tool_conti(db: Session, user_id: int, args: dict) -> dict:
    conti = (
        db.query(Conto)
        .filter(Conto.user_id == user_id, Conto.deleted_at.is_(None))
        .order_by(Conto.nome)
        .all()
    )
    totale = sum((c.saldo or Decimal("0") for c in conti), Decimal("0"))
    return {
        "conti": [
            {
                "nome": c.nome,
                "saldo": _d(c.saldo),
                "tipo": c.tipo,
                "virtuale": bool(c.virtuale),
                "predefinito": bool(c.default),
            }
            for c in conti
        ],
        "totale": _d(totale),
        "nota": "Un conto 'virtuale' è il Portafoglio aperto dall'app per chi non "
        "registra i propri conti: i movimenti senza conto finiscono lì.",
    }


def tool_categorie(db: Session, user_id: int, args: dict) -> dict:
    categorie = (
        db.query(Categoria).filter(Categoria.user_id == user_id).order_by(Categoria.nome).all()
    )
    sotto = (
        db.query(Sottocategoria)
        .filter(Sottocategoria.user_id == user_id)
        .order_by(Sottocategoria.nome)
        .all()
    )
    per_categoria: dict[int, list[str]] = {}
    for s in sotto:
        per_categoria.setdefault(s.categoria_id, []).append(s.nome)
    tag = db.query(Tag).filter(Tag.user_id == user_id).order_by(Tag.nome).all()
    return {
        "categorie": [
            {
                "nome": c.nome,
                "sottocategorie": per_categoria.get(c.id, []),
                "budget_mensile": _d(c.budget_mensile),
            }
            for c in categorie
        ],
        "tag": [t.nome for t in tag],
    }


def tool_movimenti(db: Session, user_id: int, args: dict) -> dict:
    inizio, fine = _periodo(args, default_giorni=30)
    q = _movimenti_utente(db, user_id).filter(
        Transazione.data >= inizio, Transazione.data <= fine
    )

    if args.get("tipo"):
        tipo = str(args["tipo"]).upper()
        if tipo not in ("USCITA", "ENTRATA", "RIMBORSO", "RICARICA", "ACCANTONAMENTO"):
            raise ValueError("tipo non valido")
        q = q.filter(Transazione.tipo == tipo)
    if args.get("categoria"):
        cat = _per_nome(db, Categoria, user_id, str(args["categoria"]))
        q = q.filter(Transazione.categoria_id == cat.id)
        if args.get("sottocategoria"):
            sub = _per_nome(
                db, Sottocategoria, user_id, str(args["sottocategoria"]),
                extra=(Sottocategoria.categoria_id == cat.id,),
            )
            q = q.filter(Transazione.sottocategoria_id == sub.id)
    if args.get("tag"):
        q = q.filter(Transazione.tag_id == _per_nome(db, Tag, user_id, str(args["tag"])).id)
    if args.get("conto"):
        conto = _per_nome(
            db, Conto, user_id, str(args["conto"]), extra=(Conto.deleted_at.is_(None),)
        )
        q = q.filter(Transazione.conto_id == conto.id)
    if args.get("testo"):
        testo = str(args["testo"]).strip()[:100]
        q = q.filter(Transazione.descrizione.ilike(f"%{testo}%"))
    if args.get("importo_min") is not None:
        q = q.filter(importo_effettivo() >= Decimal(str(args["importo_min"])))
    if args.get("importo_max") is not None:
        q = q.filter(importo_effettivo() <= Decimal(str(args["importo_max"])))

    totali = (
        q.order_by(None)
        .with_entities(Transazione.tipo, func.count(Transazione.id), func.sum(importo_effettivo()))
        .group_by(Transazione.tipo)
        .all()
    )
    limite = max(1, min(int(args.get("limite") or 50), 200))

    righe = (
        q.outerjoin(Categoria, Transazione.categoria_id == Categoria.id)
        .outerjoin(Sottocategoria, Transazione.sottocategoria_id == Sottocategoria.id)
        .outerjoin(Tag, Transazione.tag_id == Tag.id)
        .outerjoin(Conto, Transazione.conto_id == Conto.id)
        .with_entities(
            Transazione.data,
            Transazione.tipo,
            Transazione.importo,
            importo_effettivo().label("netto"),
            Transazione.descrizione,
            Conto.nome,
            Categoria.nome,
            Sottocategoria.nome,
            Tag.nome,
        )
        .order_by(Transazione.data.desc(), Transazione.id.desc())
        .limit(limite)
        .all()
    )
    numero = sum(n for _, n, _ in totali)
    return {
        "periodo": {"da": str(inizio), "a": str(fine)},
        "totali_per_tipo": {
            tipo: {"numero": n, "somma": _d(s)} for tipo, n, s in totali
        },
        "numero_movimenti": numero,
        "mostrati": len(righe),
        "movimenti": [
            {
                "data": str(r[0]),
                "tipo": r[1],
                "importo": _d(r[2]),
                **({"importo_netto_rimborsi": _d(r[3])} if r[3] != r[2] else {}),
                "descrizione": r[4],
                "conto": r[5],
                "categoria": r[6],
                "sottocategoria": r[7],
                "tag": r[8],
            }
            for r in righe
        ],
        "nota": "Importi positivi; il tipo dice se è un'uscita o un'entrata. "
        "Le somme sono al netto dei rimborsi ricevuti.",
    }


def _per_categoria(db: Session, user_id: int, inizio: date, fine: date, filtri=()):
    """Netto (entrate - uscite) per categoria e sottocategoria: come /statistics/monthDetails."""
    return (
        _movimenti_utente(db, user_id)
        .outerjoin(Categoria, Transazione.categoria_id == Categoria.id)
        .outerjoin(Sottocategoria, Transazione.sottocategoria_id == Sottocategoria.id)
        .filter(
            Transazione.data >= inizio,
            Transazione.data <= fine,
            Transazione.tipo.in_(("USCITA", "ENTRATA")),
            *filtri,
        )
        .with_entities(
            Categoria.id,
            Categoria.nome,
            Sottocategoria.nome,
            func.sum(get_calculated_amount()),
        )
        .group_by(Categoria.id, Categoria.nome, Sottocategoria.nome)
        .all()
    )


def tool_totali_per_categoria(db: Session, user_id: int, args: dict) -> dict:
    inizio, fine = _periodo(args)
    lato = str(args.get("lato") or "uscite").lower()
    if lato not in ("uscite", "entrate"):
        raise ValueError("lato deve essere 'uscite' o 'entrate'")
    filtri = []
    if args.get("tag"):
        filtri.append(Transazione.tag_id == _per_nome(db, Tag, user_id, str(args["tag"])).id)
    if args.get("categoria"):
        filtri.append(
            Transazione.categoria_id == _per_nome(db, Categoria, user_id, str(args["categoria"])).id
        )

    categorie: dict[str, dict] = {}
    for _, cat, sub, netto in _per_categoria(db, user_id, inizio, fine, filtri):
        voce = categorie.setdefault(cat or "Senza categoria", {"totale": Decimal("0"), "sotto": {}})
        netto = Decimal(str(netto or 0))
        voce["totale"] += netto
        nome_sub = sub or "Senza sottocategoria"
        voce["sotto"][nome_sub] = voce["sotto"].get(nome_sub, Decimal("0")) + netto

    segno = Decimal("-1") if lato == "uscite" else Decimal("1")
    righe = []
    for nome, voce in categorie.items():
        valore = voce["totale"] * segno
        if valore <= 0:
            continue
        righe.append(
            {
                "categoria": nome,
                "totale": valore,
                "sottocategorie": sorted(
                    (
                        {"nome": s, "totale": _d(v * segno)}
                        for s, v in voce["sotto"].items()
                        if v * segno > 0
                    ),
                    key=lambda x: -Decimal(x["totale"]),
                ),
            }
        )
    righe.sort(key=lambda r: -r["totale"])
    complessivo = sum((r["totale"] for r in righe), Decimal("0"))
    for r in righe:
        r["quota_percento"] = round(float(r["totale"] / complessivo * 100), 1) if complessivo else 0
        r["totale"] = _d(r["totale"])
    return {
        "periodo": {"da": str(inizio), "a": str(fine)},
        "lato": lato,
        "totale": _d(complessivo),
        "categorie": righe,
        "nota": "Come la pagina Analisi dell'app: netto per categoria (al netto dei "
        "rimborsi), senza giroconti né accantonamenti.",
    }


def tool_andamento_mensile(db: Session, user_id: int, args: dict) -> dict:
    mesi = max(1, min(int(args.get("mesi") or 6), 36))
    oggi = date.today()
    anno, mese = oggi.year, oggi.month - (mesi - 1)
    while mese <= 0:
        mese += 12
        anno -= 1
    inizio = date(anno, mese, 1)

    anno_col = extract("year", Transazione.data)
    mese_col = extract("month", Transazione.data)
    righe = (
        _movimenti_utente(db, user_id)
        .filter(
            Transazione.data >= inizio,
            Transazione.data <= oggi,
            Transazione.tipo.in_(("USCITA", "ENTRATA", "ACCANTONAMENTO")),
        )
        .with_entities(anno_col, mese_col, Transazione.tipo, func.sum(importo_effettivo()))
        .group_by(anno_col, mese_col, Transazione.tipo)
        .all()
    )
    per_mese: dict[str, dict[str, Decimal]] = {}
    a, m = inizio.year, inizio.month
    for _ in range(mesi):
        per_mese[f"{a}-{m:02d}"] = {"ENTRATA": Decimal("0"), "USCITA": Decimal("0"), "ACCANTONAMENTO": Decimal("0")}
        a, m = (a + 1, 1) if m == 12 else (a, m + 1)
    for y, mm, tipo, somma in righe:
        chiave = f"{int(y)}-{int(mm):02d}"
        if chiave in per_mese:
            per_mese[chiave][tipo] += Decimal(str(somma or 0))
    return {
        "mesi": [
            {
                "mese": k,
                "entrate": _d(v["ENTRATA"]),
                "uscite": _d(v["USCITA"]),
                "accantonato": _d(v["ACCANTONAMENTO"]),
                "risparmio": _d(v["ENTRATA"] - v["USCITA"] - v["ACCANTONAMENTO"]),
            }
            for k, v in per_mese.items()
        ],
        "nota": "Il mese corrente è parziale (fino a oggi). Importi al netto dei rimborsi.",
    }


def tool_budget(db: Session, user_id: int, args: dict) -> dict:
    oggi = date.today()
    testo = str(args.get("mese") or f"{oggi.year}-{oggi.month:02d}")
    try:
        anno, mese = (int(p) for p in testo.split("-"))
        inizio = date(anno, mese, 1)
    except ValueError:
        raise ValueError("mese deve essere AAAA-MM")
    fine = inizio.replace(day=calendar.monthrange(anno, mese)[1])

    netti: dict[int, Decimal] = {}
    for cat_id, _, _, netto in _per_categoria(db, user_id, inizio, fine):
        if cat_id is not None:
            netti[cat_id] = netti.get(cat_id, Decimal("0")) + Decimal(str(netto or 0))

    categorie = (
        db.query(Categoria)
        .filter(Categoria.user_id == user_id, Categoria.budget_mensile.isnot(None))
        .order_by(Categoria.nome)
        .all()
    )
    giorni_mese = (fine - inizio).days + 1
    trascorsi = giorni_mese if fine < oggi else max(1, (oggi - inizio).days + 1)
    righe = []
    for c in categorie:
        budget = Decimal(str(c.budget_mensile))
        if budget <= 0:
            continue
        speso = max(Decimal("0"), -netti.get(c.id, Decimal("0")))
        righe.append(
            {
                "categoria": c.nome,
                "budget": _d(budget),
                "speso": _d(speso),
                "resta": _d(budget - speso),
                "percento": round(float(speso / budget * 100), 1),
                "sforato": speso > budget,
            }
        )
    return {
        "mese": f"{anno}-{mese:02d}",
        "giorni_trascorsi": f"{min(trascorsi, giorni_mese)}/{giorni_mese}",
        "budget": righe,
        "nota": "Solo le categorie con un budget mensile impostato.",
    }


def tool_ricorrenze(db: Session, user_id: int, args: dict) -> dict:
    giorni = max(0, min(int(args.get("giorni") or 30), 366))
    limite = date.today() + timedelta(days=giorni)
    righe = (
        db.query(Ricorrenza, Conto.nome, Categoria.nome)
        .outerjoin(Conto, Ricorrenza.conto_id == Conto.id)
        .outerjoin(Categoria, Ricorrenza.categoria_id == Categoria.id)
        .filter(
            Ricorrenza.user_id == user_id,
            Ricorrenza.attiva.is_(True),
            Ricorrenza.prossima_esecuzione <= limite,
        )
        .order_by(Ricorrenza.prossima_esecuzione, Ricorrenza.id)
        .all()
    )
    return {
        "fino_al": str(limite),
        "ricorrenze": [
            {
                "nome": r.nome,
                "tipo": r.tipo,
                "importo": _d(r.importo),
                "importo_variabile": bool(r.importo_variabile),
                "frequenza": r.frequenza,
                "prossima_esecuzione": str(r.prossima_esecuzione),
                "conto": conto,
                "categoria": categoria,
                "data_fine": str(r.data_fine) if r.data_fine else None,
                "rate_rimanenti": r.rate_rimanenti,
            }
            for r, conto, categoria in righe
        ],
    }


def tool_controllo_conti(db: Session, user_id: int, args: dict) -> dict:
    """Riepilogo mese per mese più i segnali di qualcosa che non torna."""
    oggi = date.today()
    prima = (
        _movimenti_utente(db, user_id).with_entities(func.min(Transazione.data)).scalar()
    )
    inizio = _data(args.get("data_inizio"), "data_inizio") or prima or oggi.replace(day=1)
    fine = _data(args.get("data_fine"), "data_fine") or oggi
    if fine < inizio:
        raise ValueError("data_fine precede data_inizio")
    massimo = 30  # righe per tipo di anomalia: il conteggio resta completo

    # Saldi: la stessa verifica del job notturno. Può "fotografare" un conto mai
    # verificato: qui si butta via, lo strumento non scrive.
    try:
        discrepanze = verifica_saldi(db, user_id)
    finally:
        db.rollback()

    periodo = _movimenti_utente(db, user_id).filter(
        Transazione.data >= inizio, Transazione.data <= fine
    )

    def righe(q, extra=()):
        return [
            {
                "data": str(t.data),
                "tipo": t.tipo,
                "importo": _d(t.importo),
                **({"importo_netto_rimborsi": _d(t.importo_netto)} if t.importo_netto is not None else {}),
                "descrizione": t.descrizione,
                **{k: f(t) for k, f in extra},
            }
            for t in q.order_by(Transazione.data, Transazione.id).limit(massimo).all()
        ]

    # Doppioni: stesso giorno, tipo, importo e descrizione (come il controllo
    # notturno), senza quelli che l'utente ha segnato "non è un doppione".
    chiave = (
        Transazione.data,
        Transazione.tipo,
        Transazione.importo,
        func.lower(func.trim(func.coalesce(Transazione.descrizione, ""))),
    )
    gruppi = (
        periodo.filter(Transazione.non_doppione.is_(False))
        .order_by(None)
        .with_entities(Transazione.conto_id, *chiave, func.count(Transazione.id))
        .group_by(Transazione.conto_id, *chiave)
        .having(func.count(Transazione.id) > 1)
        .order_by(Transazione.data)
        .all()
    )
    doppioni = [
        {"data": str(d), "tipo": t, "importo": _d(i), "descrizione": desc, "volte": n}
        for _conto, d, t, i, desc, n in gruppi
    ]
    quadrature = [
        {
            "conto": q["conto_nome"],
            "data": str(q["data"]),
            "saldo_reale": _d(q["saldo_reale"]),
            "dalla_quadratura_del": str(q["precedente_data"]) if q["precedente_data"] else None,
            "atteso": _d(q["atteso"]) if q["atteso"] is not None else None,
            "differenza": _d(q["differenza"]) if q["differenza"] is not None else None,
        }
        for q in stato_quadrature(db, user_id)
    ]

    netto_negativo = periodo.filter(
        Transazione.tipo == "USCITA", Transazione.importo_netto < 0
    )
    padre = db.query(Transazione).filter(Transazione.user_id == user_id).subquery()
    rimborso_prima = (
        periodo.join(padre, padre.c.id == Transazione.parent_transaction_id)
        .filter(Transazione.tipo == "RIMBORSO", Transazione.data < padre.c.data)
    )
    senza_categoria = periodo.filter(
        Transazione.tipo.in_(("USCITA", "ENTRATA")), Transazione.categoria_id.is_(None)
    )
    futuri = periodo.filter(Transazione.data > oggi)

    anno_col = extract("year", Transazione.data)
    mese_col = extract("month", Transazione.data)
    per_mese = (
        periodo.order_by(None)
        .with_entities(anno_col, mese_col, Transazione.tipo, func.count(Transazione.id), func.sum(importo_effettivo()))
        .group_by(anno_col, mese_col, Transazione.tipo)
        .all()
    )
    mesi: dict[str, dict] = {}
    for y, m, tipo, n, somma in per_mese:
        voce = mesi.setdefault(f"{int(y)}-{int(m):02d}", {"movimenti": 0})
        voce["movimenti"] += n
        voce[tipo.lower()] = _d(somma)
    for voce in mesi.values():
        voce["netto"] = _d(
            Decimal(voce.get("entrata") or 0) - Decimal(voce.get("uscita") or 0)
            - Decimal(voce.get("accantonamento") or 0)
        )

    return {
        "periodo": {"da": str(inizio), "a": str(fine)},
        "saldi": {
            "ok": not discrepanze,
            "discrepanze": [
                {k: (_d(v) if isinstance(v, Decimal) else v) for k, v in d.items() if k != "conto_id"}
                for d in discrepanze
            ],
        },
        "mesi": dict(sorted(mesi.items())),
        "quadrature": quadrature[:massimo],
        "anomalie": {
            "possibili_doppioni": {"numero": len(doppioni), "righe": doppioni[:massimo]},
            "rimborsi_oltre_la_spesa": {
                "numero": netto_negativo.count(),
                "righe": righe(netto_negativo),
            },
            "rimborso_prima_della_spesa": {
                "numero": rimborso_prima.count(),
                "righe": righe(rimborso_prima, (("data_spesa", lambda t: str(t.parent_transaction.data)),)),
            },
            "senza_categoria": {"numero": senza_categoria.count(), "righe": righe(senza_categoria)},
            "date_future": {"numero": futuri.count(), "righe": righe(futuri)},
        },
        "nota": "saldi.ok dice se il saldo di ogni conto torna con i suoi movimenti (la "
        "stessa verifica notturna dell'app). Le anomalie sono segnali da guardare, non "
        "errori certi: due caffè uguali nello stesso giorno sono un doppione legittimo. "
        "quadrature: i saldi reali che l'utente ha segnato (dalla più recente); la prima di "
        "un conto è il punto di partenza, le altre hanno atteso = reale della precedente + "
        "movimenti registrati in mezzo, e differenza = atteso - reale (diversa da zero: "
        "manca un movimento o un importo è sbagliato in quel periodo).",
    }


_DATE = {
    "data_inizio": {"type": "string", "description": "AAAA-MM-GG, incluso"},
    "data_fine": {"type": "string", "description": "AAAA-MM-GG, incluso"},
}

TOOLS: dict[str, tuple[Callable[[Session, int, dict], dict], dict]] = {
    "conti": (
        tool_conti,
        {
            "title": "Conti e saldi",
            "description": "Elenca i conti con il saldo attuale e il totale dei conti reali.",
            "inputSchema": {"type": "object", "properties": {}},
        },
    ),
    "categorie": (
        tool_categorie,
        {
            "title": "Categorie e tag",
            "description": "Categorie con sottocategorie e budget mensile, e l'elenco dei tag. "
            "Usalo per conoscere i nomi esatti da passare agli altri strumenti.",
            "inputSchema": {"type": "object", "properties": {}},
        },
    ),
    "movimenti": (
        tool_movimenti,
        {
            "title": "Cerca movimenti",
            "description": "Cerca i movimenti (spese, entrate, rimborsi, giroconti, accantonamenti) "
            "con filtri. Restituisce i totali per tipo su tutto il risultato e i movimenti più "
            "recenti fino a `limite`. Senza date: ultimi 30 giorni.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    **_DATE,
                    "tipo": {
                        "type": "string",
                        "enum": ["USCITA", "ENTRATA", "RIMBORSO", "RICARICA", "ACCANTONAMENTO"],
                        "description": "RICARICA è un giroconto tra conti",
                    },
                    "categoria": {"type": "string", "description": "Nome della categoria"},
                    "sottocategoria": {"type": "string", "description": "Richiede anche categoria"},
                    "tag": {"type": "string"},
                    "conto": {"type": "string"},
                    "testo": {"type": "string", "description": "Cerca nella descrizione"},
                    "importo_min": {"type": "number"},
                    "importo_max": {"type": "number"},
                    "limite": {"type": "integer", "minimum": 1, "maximum": 200, "default": 50},
                },
            },
        },
    ),
    "totali_per_categoria": (
        tool_totali_per_categoria,
        {
            "title": "Totali per categoria",
            "description": "Uscite (o entrate) di un periodo raggruppate per categoria e "
            "sottocategoria, con la quota di ognuna: gli stessi numeri della pagina Analisi. "
            "Senza date: mese corrente.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    **_DATE,
                    "lato": {"type": "string", "enum": ["uscite", "entrate"], "default": "uscite"},
                    "categoria": {"type": "string", "description": "Restringe a una categoria"},
                    "tag": {"type": "string", "description": "Solo i movimenti con questo tag"},
                },
            },
        },
    ),
    "andamento_mensile": (
        tool_andamento_mensile,
        {
            "title": "Andamento mensile",
            "description": "Entrate, uscite, accantonamenti e risparmio mese per mese, "
            "fino al mese corrente.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "mesi": {"type": "integer", "minimum": 1, "maximum": 36, "default": 6}
                },
            },
        },
    ),
    "budget": (
        tool_budget,
        {
            "title": "Budget del mese",
            "description": "Per ogni categoria con un budget mensile: budget, speso, quanto "
            "resta e se è sforato.",
            "inputSchema": {
                "type": "object",
                "properties": {"mese": {"type": "string", "description": "AAAA-MM, default il mese corrente"}},
            },
        },
    ),
    "ricorrenze": (
        tool_ricorrenze,
        {
            "title": "Ricorrenze in arrivo",
            "description": "Le ricorrenze attive (abbonamenti, rate, stipendio…) con la prossima "
            "esecuzione entro `giorni` da oggi, comprese quelle in ritardo.",
            "inputSchema": {
                "type": "object",
                "properties": {"giorni": {"type": "integer", "minimum": 0, "maximum": 366, "default": 30}},
            },
        },
    ),
    "controllo_conti": (
        tool_controllo_conti,
        {
            "title": "Controllo dei conti",
            "description": "Verifica che i saldi tornino con i movimenti e cerca anomalie "
            "(possibili doppioni, rimborsi che superano la spesa, rimborsi datati prima "
            "della spesa, movimenti senza categoria o con data futura), con un riepilogo "
            "mese per mese e le quadrature (saldi reali segnati dall'utente). Senza date: dal primo movimento a oggi.",
            "inputSchema": {"type": "object", "properties": {**_DATE}},
        },
    ),
}

ISTRUZIONI = (
    "Dati di SpassoConti, l'app di finanze personali dell'utente, in sola lettura. "
    "Importi in euro, come stringhe con due decimali. Le date sono AAAA-MM-GG. "
    "Per categorie, tag e conti servono i nomi esatti: se non li conosci, chiama prima "
    "`categorie` (o `conti`). `totali_per_categoria` e `budget` usano le stesse regole "
    "dell'app (netto dei rimborsi, niente giroconti né accantonamenti)."
)


# --- Endpoint MCP ------------------------------------------------------------


def _non_autorizzato(request: Request, errore: str = "invalid_token") -> Response:
    return JSONResponse(
        {"error": errore, "error_description": "Serve un token OAuth valido"},
        status_code=401,
        headers={
            "WWW-Authenticate": (
                f'Bearer error="{errore}", '
                f'resource_metadata="{_resource_metadata_url(request)}"'
            )
        },
    )


def _rpc_ok(id_: Any, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": id_, "result": result}


def _rpc_err(id_: Any, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": id_, "error": {"code": code, "message": message}}


def _gestisci(db: Session, user_id: int, msg: Any) -> Optional[dict]:
    if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0" or "method" not in msg:
        return _rpc_err(msg.get("id") if isinstance(msg, dict) else None, -32600, "Invalid Request")
    metodo, id_ = msg["method"], msg.get("id")
    params = msg.get("params") or {}
    if "id" not in msg:  # notifica (es. notifications/initialized): nessuna risposta
        return None

    if metodo == "initialize":
        richiesta = params.get("protocolVersion")
        return _rpc_ok(
            id_,
            {
                "protocolVersion": richiesta if richiesta in PROTOCOL_VERSIONS else PROTOCOL_VERSIONS[0],
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": {"name": "spassoconti", "title": "SpassoConti", "version": "1.0.0"},
                "instructions": ISTRUZIONI,
            },
        )
    if metodo == "ping":
        return _rpc_ok(id_, {})
    if metodo == "tools/list":
        return _rpc_ok(
            id_,
            {
                "tools": [
                    {
                        "name": nome,
                        **definizione,
                        "annotations": {"readOnlyHint": True, "openWorldHint": False},
                    }
                    for nome, (_, definizione) in TOOLS.items()
                ]
            },
        )
    if metodo == "tools/call":
        nome = params.get("name")
        if nome not in TOOLS:
            return _rpc_err(id_, -32602, f"Strumento sconosciuto: {nome}")
        args = params.get("arguments") or {}
        if not isinstance(args, dict):
            return _rpc_err(id_, -32602, "arguments deve essere un oggetto")
        try:
            risultato = TOOLS[nome][0](db, user_id, args)
        except (ValueError, TypeError, ArithmeticError) as e:
            return _rpc_ok(id_, {"content": [{"type": "text", "text": f"Errore: {e}"}], "isError": True})
        except Exception:
            logger.exception("MCP: errore nello strumento %s", nome)
            db.rollback()
            return _rpc_ok(
                id_,
                {"content": [{"type": "text", "text": "Errore interno, riprova."}], "isError": True},
            )
        testo = json.dumps(risultato, ensure_ascii=False, default=str)
        return _rpc_ok(id_, {"content": [{"type": "text", "text": testo}]})
    if metodo in ("resources/list", "prompts/list"):
        chiave = metodo.split("/")[0]
        return _rpc_ok(id_, {chiave: []})
    return _rpc_err(id_, -32601, f"Metodo non supportato: {metodo}")


@router.post("/mcp", include_in_schema=False)
async def mcp_endpoint(request: Request, db: Session = Depends(get_db)):
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return _non_autorizzato(request, "invalid_request")
    payload = verifica(header[7:].strip(), "access")
    if not payload:
        return _non_autorizzato(request)
    try:
        body = await request.json()
    except ValueError:
        return JSONResponse(_rpc_err(None, -32700, "Parse error"), status_code=400)
    return await run_in_threadpool(_esegui, request, db, payload, body)


def _esegui(request: Request, db: Session, payload: dict, body: Any) -> Response:
    user = _utente_valido(db, payload)
    if not user:
        return _non_autorizzato(request)
    if isinstance(body, list):
        risposte = [r for r in (_gestisci(db, user.id, m) for m in body) if r is not None]
        return JSONResponse(risposte) if risposte else Response(status_code=202)
    risposta = _gestisci(db, user.id, body)
    if risposta is None:
        return Response(status_code=202)
    return JSONResponse(risposta)


@router.get("/mcp", include_in_schema=False)
@router.delete("/mcp", include_in_schema=False)
def mcp_senza_stream():
    # Nessuno stream lato server e nessuna sessione da chiudere.
    return Response(status_code=405, headers={"Allow": "POST"})
