"""Verifica in due passaggi (TOTP): attivazione, disattivazione, secondo passo del login.

Flusso di attivazione: /setup genera il segreto (salvato cifrato, ancora
inattivo) e l'otpauth:// per l'app di autenticazione; /enable lo attiva solo
quando l'utente presenta un codice giusto — prova che l'app è configurata — e
restituisce i codici di recupero, una volta sola.

I codici sbagliati rispondono 400, non 401: per il FE un 401 su una chiamata
autenticata vuol dire "sessione finita" e farebbe uscire l'utente.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

import auth
from database import get_db
from models import RecoveryCode, User
from rate_limit import limiter
from schemas import (
    RecoveryCodesOut,
    Token,
    TwoFactorCode,
    TwoFactorDisable,
    TwoFactorSetup,
    TwoFactorStatus,
    TwoFactorVerify,
)

router = APIRouter(prefix="/auth/2fa", tags=["Auth"])

logger = logging.getLogger(__name__)

CODICE_ERRATO = "Invalid two-factor code"


def _utente(db: Session, user_id: int, lock: bool = False) -> User:
    query = db.query(User).filter(User.id == user_id)
    # Il lock serializza due verifiche simultanee: senza, lo stesso codice
    # passerebbe due volte prima che `totp_last_step` venga salvato.
    if lock:
        query = query.with_for_update()
    user = query.first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Your session may have expired",
        )
    return user


def _stato(db: Session, user: User) -> dict:
    return {
        "enabled": bool(user.totp_enabled),
        "recovery_codes_remaining": (
            auth.codici_recupero_rimasti(db, user.id) if user.totp_enabled else 0
        ),
    }


@router.post("/verify", response_model=Token)
@limiter.limit("10/minute;30/hour")
def verify_two_factor(
    payload: TwoFactorVerify,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Secondo passo del login: token del primo passo + codice → sessione."""
    claims = auth.decode_mfa_token(payload.mfa_token)
    user = db.query(User).filter(User.id == claims["user_id"]).with_for_update().first()

    # Password cambiata o logout ovunque dopo il primo passo: il token non vale.
    if (
        not user
        or not user.totp_enabled
        or user.token_version != claims.get("token_version")
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Two-factor session expired, please log in again",
        )

    if not auth.verifica_secondo_fattore(db, user, payload.code):
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=CODICE_ERRATO)

    # Il commit di apri_sessione salva anche totp_last_step / il codice di
    # recupero bruciato.
    return auth.apri_sessione(db, user, request, response)


@router.get("", response_model=TwoFactorStatus)
def get_two_factor_status(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    return _stato(db, _utente(db, current_user_id))


@router.post("/setup", response_model=TwoFactorSetup)
def setup_two_factor(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    """Nuovo segreto, ancora inattivo. Rilanciarlo ne genera un altro: vale
    l'ultimo, quello che l'utente ha davanti."""
    user = _utente(db, current_user_id)
    if user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Two-factor authentication is already enabled",
        )

    segreto = auth.nuovo_segreto_totp()
    try:
        user.totp_secret = auth.cifra_segreto_totp(segreto)
        user.totp_last_step = None
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Setup 2FA fallito per user_id=%s", current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not start the two-factor setup",
        )

    return {"secret": segreto, "otpauth_uri": auth.uri_totp(segreto, user.email)}


@router.post("/enable", response_model=RecoveryCodesOut)
@limiter.limit("10/minute")
def enable_two_factor(
    payload: TwoFactorCode,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    user = _utente(db, current_user_id, lock=True)
    if user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Two-factor authentication is already enabled",
        )
    if not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start the two-factor setup first",
        )

    # Solo il codice dell'app: i codici di recupero ancora non esistono, ed è
    # proprio l'app che si sta verificando.
    codice = payload.code.strip().replace(" ", "")
    if not (codice.isdigit() and len(codice) == 6) or not auth.verifica_secondo_fattore(
        db, user, codice
    ):
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=CODICE_ERRATO)

    try:
        user.totp_enabled = True
        codici = auth.genera_codici_recupero(db, user.id)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Attivazione 2FA fallita per user_id=%s", current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not enable two-factor authentication",
        )

    return {"recovery_codes": codici}


@router.post("/disable", response_model=TwoFactorStatus)
@limiter.limit("10/minute")
def disable_two_factor(
    payload: TwoFactorDisable,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    """Password e codice insieme: chi trova il telefono sbloccato con la
    sessione aperta non deve poter togliere la protezione."""
    user = _utente(db, current_user_id, lock=True)
    if not user.totp_enabled:
        return _stato(db, user)

    if not auth.verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid password"
        )
    if not auth.verifica_secondo_fattore(db, user, payload.code):
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=CODICE_ERRATO)

    try:
        user.totp_enabled = False
        user.totp_secret = None
        user.totp_last_step = None
        db.query(RecoveryCode).filter(RecoveryCode.user_id == user.id).delete()
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Disattivazione 2FA fallita per user_id=%s", current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not disable two-factor authentication",
        )

    return _stato(db, user)


@router.post("/recovery-codes", response_model=RecoveryCodesOut)
@limiter.limit("10/minute")
def regenerate_recovery_codes(
    payload: TwoFactorCode,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    """Codici nuovi al posto dei vecchi (finiti, o finiti in mani sbagliate)."""
    user = _utente(db, current_user_id, lock=True)
    if not user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Two-factor authentication is not enabled",
        )
    if not auth.verifica_secondo_fattore(db, user, payload.code):
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=CODICE_ERRATO)

    try:
        codici = auth.genera_codici_recupero(db, user.id)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Rigenerazione codici 2FA fallita per user_id=%s", current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not regenerate the recovery codes",
        )

    return {"recovery_codes": codici}
