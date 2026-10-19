from dotenv import load_dotenv
import base64
import bcrypt
import hashlib
import hmac
import logging
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from cryptography.fernet import Fernet, InvalidToken
import pyotp
# PyJWT e non python-jose: jose è fermo, e fino alla 3.5.0 accetta chiavi
# pubbliche come segreto HMAC (CVE-2026-85394, nessuna versione corretta).
import jwt
from jwt import PyJWTError
from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import SessionLocal
from models import RecoveryCode, RefreshToken, User

load_dotenv()

logger = logging.getLogger(__name__)

# L'access token è volutamente a vita breve: se viene rubato (es. XSS) la finestra
# di abuso è di minuti, non di giorni. La sessione lunga la regge il refresh token,
# che sta in un cookie httpOnly e non è leggibile da JavaScript.
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 90))

REFRESH_COOKIE_NAME = "refresh_token"
# Il refresh token serve solo agli endpoint di sessione: limitando il path, il
# cookie non viene nemmeno allegato alle altre chiamate API.
# Il path è quello visto dal browser, quindi con il prefisso /api (main.API_PREFIX).
REFRESH_COOKIE_PATH = "/api/auth"
# Un refresh token riusato entro questa finestra è un rinnovo concorrente della
# stessa sessione (due schede), non un replay: vedi consume_refresh_token.
REFRESH_CONCORRENTE = timedelta(seconds=10)


def get_password_hash(password: str):
    # Trasforma la stringa in byte, genera il sale e fa l'hash
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(pwd_bytes, salt)
    # Restituisce l'hash come stringa per salvarlo nel DB
    return hashed_password.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str):
    password_byte = plain_password.encode("utf-8")
    hashed_byte = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_byte, hashed_byte)


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, os.getenv("SECRET_KEY"), algorithm=os.getenv("ALGORITHM")
    )
    return encoded_jwt


# --- VERIFICA IN DUE PASSAGGI (TOTP) -----------------------------------------
#
# Il login di chi ha la 2FA attiva è in due tempi: la password giusta non dà la
# sessione, ma un token a 5 minuti buono solo per POST /auth/2fa/verify, dove si
# presenta il codice dell'app di autenticazione (o un codice di recupero).
# La 2FA si chiede al login: il refresh di una sessione già aperta non la ripete,
# il dispositivo l'ha già superata.

TOTP_ISSUER = "SpassoConti"
MFA_TOKEN_EXPIRE_MINUTES = 5
MFA_SCOPE = "mfa"
CODICI_RECUPERO = 10


def create_mfa_token(user: User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=MFA_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {
            "user_id": user.id,
            "token_version": user.token_version,
            "scope": MFA_SCOPE,
            "exp": expire,
        },
        os.getenv("SECRET_KEY"),
        algorithm=os.getenv("ALGORITHM"),
    )


def decode_mfa_token(token: str) -> dict:
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Two-factor session expired, please log in again",
    )
    try:
        payload = jwt.decode(
            token, os.getenv("SECRET_KEY"), algorithms=[os.getenv("ALGORITHM")]
        )
    except PyJWTError:
        raise invalid
    if payload.get("scope") != MFA_SCOPE or payload.get("user_id") is None:
        raise invalid
    return payload


def _cifrario_totp() -> Fernet:
    """Chiave Fernet derivata da SECRET_KEY.

    Niente variabile d'ambiente in più da dimenticare. Il prezzo: se SECRET_KEY
    cambia, i segreti salvati non si decifrano più e i codici dell'app smettono
    di valere. Si entra con un codice di recupero (sono solo hash, non cifrati)
    e si riconfigura la 2FA.
    """
    chiave = hashlib.sha256(
        b"spassoconti-totp:" + os.getenv("SECRET_KEY", "").encode("utf-8")
    ).digest()
    return Fernet(base64.urlsafe_b64encode(chiave))


def cifra_segreto_totp(segreto: str) -> str:
    return _cifrario_totp().encrypt(segreto.encode("utf-8")).decode("utf-8")


def _decifra_segreto_totp(cifrato: str | None) -> str | None:
    if not cifrato:
        return None
    try:
        return _cifrario_totp().decrypt(cifrato.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        logger.error(
            "Segreto TOTP non decifrabile (SECRET_KEY cambiata?): "
            "serve un codice di recupero"
        )
        return None


def nuovo_segreto_totp() -> str:
    return pyotp.random_base32()


def uri_totp(segreto: str, email: str) -> str:
    """L'otpauth:// che le app di autenticazione leggono dal QR (o dal link)."""
    return pyotp.TOTP(segreto).provisioning_uri(name=email, issuer_name=TOTP_ISSUER)


def _normalizza_codice(codice: str) -> str:
    return codice.strip().replace(" ", "").replace("-", "").lower()


def _verifica_codice_totp(user: User, codice: str) -> bool:
    """Accetta il codice dell'intervallo corrente e dei due vicini (±30 s di
    orologio sfasato), ma mai uno già usato: `totp_last_step` sale a ogni
    codice accettato, così chi lo legge da sopra la spalla non lo riusa."""
    segreto = _decifra_segreto_totp(user.totp_secret)
    if not segreto:
        return False
    totp = pyotp.TOTP(segreto)
    adesso = int(time.time()) // totp.interval
    for step in (adesso - 1, adesso, adesso + 1):
        if user.totp_last_step is not None and step <= user.totp_last_step:
            continue
        if hmac.compare_digest(totp.at(step * totp.interval), codice):
            user.totp_last_step = step
            return True
    return False


def _hash_codice_recupero(codice: str) -> str:
    return hashlib.sha256(_normalizza_codice(codice).encode("utf-8")).hexdigest()


def genera_codici_recupero(db: Session, user_id: int) -> list[str]:
    """Sostituisce i codici di recupero dell'utente con 10 nuovi.

    Restituisce i codici in chiaro: è l'unica volta che esistono, l'utente li
    deve salvare adesso. Formato "a1b2c-3d4e5" (40 bit, il trattino è solo
    per leggerli).
    """
    db.query(RecoveryCode).filter(RecoveryCode.user_id == user_id).delete()
    codici = []
    for _ in range(CODICI_RECUPERO):
        grezzo = secrets.token_hex(5)
        codici.append(f"{grezzo[:5]}-{grezzo[5:]}")
        db.add(RecoveryCode(user_id=user_id, code_hash=_hash_codice_recupero(grezzo)))
    return codici


def codici_recupero_rimasti(db: Session, user_id: int) -> int:
    return (
        db.query(RecoveryCode)
        .filter(RecoveryCode.user_id == user_id, RecoveryCode.used_at.is_(None))
        .count()
    )


def _usa_codice_recupero(db: Session, user_id: int, codice: str) -> bool:
    riga = (
        db.query(RecoveryCode)
        .filter(
            RecoveryCode.user_id == user_id,
            RecoveryCode.code_hash == _hash_codice_recupero(codice),
            RecoveryCode.used_at.is_(None),
        )
        .with_for_update()
        .first()
    )
    if riga is None:
        return False
    riga.used_at = datetime.now(timezone.utc)
    return True


def apri_sessione(db: Session, user: User, request: Request, response: Response) -> dict:
    """Emette la sessione del dispositivo: refresh token nel cookie httpOnly e
    access token nella risposta. Fa il commit (insieme a quello che il chiamante
    ha già scritto, es. il codice di recupero consumato).

    Qui le credenziali sono già state validate: se fallisce, il problema è la
    creazione della sessione, e il messaggio deve dirlo invece di far sembrare
    il login stesso rotto (vedi `/auth/refresh`, stessa gestione).
    """
    try:
        raw_refresh = issue_refresh_token(
            db, user.id, user_agent=request.headers.get("user-agent")
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception(
            "Login: creazione della sessione fallita per user_id=%s", user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Credentials are valid but the device session could not be created. Please try again",
        )

    set_refresh_cookie(response, raw_refresh)

    # La token_version nel JWT serve a invalidarlo (cambio password, logout-all)
    access_token = create_access_token(
        data={"user_id": user.id, "token_version": user.token_version}
    )
    return {"access_token": access_token, "username": user.username}


def verifica_secondo_fattore(db: Session, user: User, codice: str) -> bool:
    """Codice a 6 cifre dell'app, oppure un codice di recupero (che si brucia).

    Non fa commit: lo fa il chiamante, insieme al resto (sessione emessa, 2FA
    attivata o spenta).
    """
    codice = _normalizza_codice(codice or "")
    if not codice:
        return False
    if codice.isdigit() and len(codice) == 6:
        return _verifica_codice_totp(user, codice)
    return _usa_codice_recupero(db, user.id, codice)


# --- REFRESH TOKEN (sessione persistente per dispositivo) ---------------------


def _hash_refresh_token(raw_token: str) -> str:
    """SHA-256 del token. In DB non finisce mai il valore in chiaro.

    Qui basta un hash veloce (non bcrypt): il token è già 256 bit di entropia
    casuale, quindi non è attaccabile a dizionario come una password.
    """
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def issue_refresh_token(
    db: Session,
    user_id: int,
    user_agent: str | None = None,
    family_id: str | None = None,
) -> str:
    """Crea un refresh token e ne salva solo l'hash. Restituisce il valore in chiaro
    (l'unico momento in cui esiste), da mettere nel cookie httpOnly.

    `family_id` viene passato in fase di rotazione per restare nella stessa catena.
    """
    raw_token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)

    db_token = RefreshToken(
        user_id=user_id,
        token_hash=_hash_refresh_token(raw_token),
        family_id=family_id or secrets.token_urlsafe(32),
        expires_at=now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        created_at=now,
        user_agent=(user_agent or "")[:255] or None,
    )
    db.add(db_token)
    return raw_token


def revoke_token_family(db: Session, user_id: int, family_id: str) -> None:
    """Revoca tutti i token di una famiglia (usata quando si sospetta un furto)."""
    now = datetime.now(timezone.utc)
    (
        db.query(RefreshToken)
        .filter(
            RefreshToken.user_id == user_id,
            RefreshToken.family_id == family_id,
            RefreshToken.revoked_at.is_(None),
        )
        .update({"revoked_at": now})
    )


def revoke_session(db: Session, raw_token: str) -> bool:
    """Revoca la sessione a cui appartiene `raw_token` (logout del dispositivo).

    Non solleva se il token è ignoto: un logout deve riuscire comunque.
    """
    db_token = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == _hash_refresh_token(raw_token))
        .first()
    )
    if not db_token:
        return False

    revoke_token_family(db, db_token.user_id, db_token.family_id)
    return True


def revoke_all_user_tokens(db: Session, user_id: int) -> None:
    """Disconnette l'utente da tutti i dispositivi."""
    now = datetime.now(timezone.utc)
    (
        db.query(RefreshToken)
        .filter(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
        .update({"revoked_at": now})
    )


def _as_utc(value: datetime) -> datetime:
    """Le colonne DateTime sono naive: le trattiamo come UTC per confrontarle."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def consume_refresh_token(db: Session, raw_token: str) -> RefreshToken:
    """Valida un refresh token e lo marca come usato (rotazione).

    Se il token è già stato usato siamo davanti a un replay: qualcuno ha copiato il
    cookie. Non possiamo sapere se sia la vittima o l'attaccante a presentarlo, quindi
    revochiamo l'intera famiglia e obblighiamo entrambi a rifare il login.
    """
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired session",
    )

    # FOR UPDATE: due refresh simultanei con lo stesso cookie (due schede)
    # passerebbero entrambi il controllo su used_at e aprirebbero due rami della
    # stessa famiglia, aggirando la reuse detection. Col lock il secondo aspetta
    # e trova il token già usato.
    db_token = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == _hash_refresh_token(raw_token))
        .with_for_update()
        .first()
    )

    if not db_token:
        raise invalid

    if db_token.revoked_at is not None:
        raise invalid

    if db_token.used_at is not None and datetime.now(timezone.utc) - _as_utc(
        db_token.used_at
    ) < REFRESH_CONCORRENTE:
        # Usato da pochi secondi: è l'altra scheda che ha rinnovato nello stesso
        # istante, non un furto. Niente revoca (butterebbe fuori l'utente): un
        # 409, e il browser ha già il cookie nuovo per il tentativo successivo.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Session refresh already in progress",
        )

    if db_token.used_at is not None:
        # Reuse detection: token già ruotato → sessione compromessa.
        logger.warning(
            "Riuso di un refresh token già ruotato (user_id=%s, family=%s): "
            "revoco l'intera famiglia",
            db_token.user_id,
            db_token.family_id,
        )
        revoke_token_family(db, db_token.user_id, db_token.family_id)
        db.commit()
        raise invalid

    if _as_utc(db_token.expires_at) < datetime.now(timezone.utc):
        raise invalid

    db_token.used_at = datetime.now(timezone.utc)
    db.add(db_token)
    return db_token


def set_refresh_cookie(response: Response, raw_token: str) -> None:
    """Cookie httpOnly: illeggibile da JavaScript, quindi non rubabile via XSS.

    FE e BE stanno sullo stesso dominio (conti.spassocasa.it, il BE sotto /api),
    quindi `SameSite=Lax` è sufficiente e il cookie viaggia comunque. In locale
    (http) `Secure` va spento, altrimenti il browser scarta il cookie.
    """
    secure = os.getenv("COOKIE_SECURE", "true").lower() != "false"
    domain = os.getenv("COOKIE_DOMAIN") or None

    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=raw_token,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=secure,
        samesite="lax",
        path=REFRESH_COOKIE_PATH,
        domain=domain,
    )


def clear_refresh_cookie(response: Response) -> None:
    secure = os.getenv("COOKIE_SECURE", "true").lower() != "false"
    domain = os.getenv("COOKIE_DOMAIN") or None

    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        httponly=True,
        secure=secure,
        samesite="lax",
        path=REFRESH_COOKIE_PATH,
        domain=domain,
    )


def get_refresh_token_from_request(request: Request) -> str:
    raw_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing session cookie",
        )
    return raw_token


# --- ACCESS TOKEN -------------------------------------------------------------


def get_db_session():
    """Sessione DB per le dipendenze definite qui (evita l'import di database.get_db
    dentro auth.py, che è importato da database-adjacent modules)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


security = HTTPBearer()


# Per evitare un'importazione circolare in auth.py, passiamo una dipendenza lazy o creiamo get_current_user_id nel router
def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials  # Estrae automaticamente la stringa dopo 'Bearer '

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        secret = os.getenv("SECRET_KEY")
        algo = os.getenv("ALGORITHM")

        payload = jwt.decode(token, secret, algorithms=[algo])

        user_id: int = payload.get("user_id")
        token_version: int = payload.get("token_version", 1)

        # Un token con `scope` non è un access token: è quello a 5 minuti del
        # secondo passaggio della 2FA (create_mfa_token). Accettarlo qui vorrebbe
        # dire entrare con la sola password.
        if payload.get("scope") is not None:
            logger.debug("token con scope %s usato come access token", payload.get("scope"))
            raise credentials_exception

        if user_id is None:
            logger.debug("user_id non trovato nel payload del token")
            raise credentials_exception

        # Creiamo una sessione DB al volo per verificare la validità del token rispetto alla password cambiata
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user or user.token_version != token_version:
                logger.debug("token obsoleto o utente non trovato")
                raise credentials_exception
        finally:
            db.close()

        return user_id

    except PyJWTError:
        logger.debug("Token JWT non valido", exc_info=True)
        raise credentials_exception


def get_admin_user_id(
    db: Session = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> int:
    """L'Open Banking è riservato a un solo utente (l'admin).

    Vive qui e non in un router perché la usano sia `open_banking` (flusso Enable
    Banking) sia `bank_connectors` (che salva le credenziali della banca): sono le
    uniche parti che maneggiano token bancari, e devono avere lo stesso cancello.
    L'admin è identificato da OPEN_BANKING_ADMIN_EMAIL; se la variabile non c'è, la
    funzionalità è chiusa per tutti.
    """
    admin_email = os.getenv("OPEN_BANKING_ADMIN_EMAIL")
    if not admin_email:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Open Banking admin is not configured",
        )
    user = db.query(User).filter(User.id == current_user_id).first()
    if not user or user.email.lower() != admin_email.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Open Banking is restricted to the admin user",
        )
    return current_user_id
