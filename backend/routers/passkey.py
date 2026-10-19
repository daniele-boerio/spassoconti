"""Passkey (WebAuthn): accesso con Face ID, impronta o PIN del dispositivo.

Due cerimonie, ognuna in due tempi (opzioni → risposta firmata dal dispositivo):
- registrazione, da utente loggato (Impostazioni → Sicurezza);
- login, senza username: le passkey sono "discoverable", è il dispositivo a
  proporre quelle del sito, e dalla passkey si risale all'utente.

Il login con passkey non chiede il codice della 2FA: la passkey è già due
fattori in uno (il dispositivo che la custodisce + biometria/PIN, richiesta
con user_verification=required), come fanno Google, Apple e GitHub.

La sfida di ogni cerimonia sta in `webauthn_challenges` e si cancella all'uso:
una risposta intercettata non si può ripresentare.
"""

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

import auth
from database import get_db
from models import Passkey, User, WebauthnChallenge
from rate_limit import limiter
from schemas import (
    PasskeyLoginVerify,
    PasskeyOptionsOut,
    PasskeyOut,
    PasskeyRegisterVerify,
    Token,
)

router = APIRouter(prefix="/auth/passkey", tags=["Auth"])

logger = logging.getLogger(__name__)

RP_NAME = "SpassoConti"
DURATA_SFIDA = timedelta(minutes=5)
PASSKEY_NON_VALIDA = "Passkey not recognized"


def _relying_party() -> tuple[str, list[str]]:
    """Dominio (RP ID) e origini ammesse.

    Di default dal FRONTEND_URL: in produzione conti.spassocasa.it. Le passkey
    sono legate al dominio: registrate lì non valgono altrove. Fuori produzione
    si accettano anche i dev server di Vite (5173, e 5174 dell'E2E).
    """
    frontend = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    rp_id = os.getenv("WEBAUTHN_RP_ID") or urlparse(frontend).hostname or "localhost"
    origini = [
        o.strip().rstrip("/")
        for o in os.getenv("WEBAUTHN_ORIGINS", frontend).split(",")
        if o.strip()
    ]
    if os.getenv("ENVIRONMENT", "development").lower() != "production":
        origini += ["http://localhost:5173", "http://localhost:5174"]
    return rp_id, origini


def _adesso() -> datetime:
    # Colonne DateTime naive, in UTC (come refresh_tokens).
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _salva_sfida(db: Session, challenge: bytes, tipo: str, user_id: int | None) -> None:
    db.add(
        WebauthnChallenge(
            challenge=bytes_to_base64url(challenge),
            tipo=tipo,
            user_id=user_id,
            expires_at=_adesso() + DURATA_SFIDA,
        )
    )
    db.commit()


def _consuma_sfida(
    db: Session, credential: dict, tipo: str, user_id: int | None = None
) -> bytes:
    """Ritrova la sfida firmata dal dispositivo (sta in clientDataJSON) e la
    cancella: vale una volta sola. 400 se manca, è scaduta o è di un altro."""
    try:
        client_data = json.loads(
            base64url_to_bytes(credential["response"]["clientDataJSON"])
        )
        challenge = client_data["challenge"]
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=PASSKEY_NON_VALIDA)

    query = db.query(WebauthnChallenge).filter(
        WebauthnChallenge.challenge == challenge,
        WebauthnChallenge.tipo == tipo,
    )
    if user_id is not None:
        query = query.filter(WebauthnChallenge.user_id == user_id)
    sfida = query.with_for_update().first()

    if sfida is None or sfida.expires_at < _adesso():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passkey request expired, please try again",
        )
    db.delete(sfida)
    db.commit()
    return base64url_to_bytes(challenge)


def _nome_dispositivo(user_agent: str) -> str:
    """Un nome leggibile per la lista ("iPhone", "Mac"…)."""
    for chiave, nome in (
        ("iPhone", "iPhone"),
        ("iPad", "iPad"),
        ("Android", "Android"),
        ("Macintosh", "Mac"),
        ("Windows", "Windows"),
    ):
        if chiave in user_agent:
            return nome
    return "Passkey"


@router.get("", response_model=list[PasskeyOut])
def list_passkeys(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    return (
        db.query(Passkey)
        .filter(Passkey.user_id == current_user_id)
        .order_by(Passkey.created_at)
        .all()
    )


@router.delete("/{passkey_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_passkey(
    passkey_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    passkey = (
        db.query(Passkey)
        .filter(Passkey.id == passkey_id, Passkey.user_id == current_user_id)
        .first()
    )
    if not passkey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Passkey not found")
    db.delete(passkey)
    db.commit()


@router.post("/register/options", response_model=PasskeyOptionsOut)
def register_options(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    user = db.query(User).filter(User.id == current_user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    rp_id, _ = _relying_party()
    esistenti = db.query(Passkey).filter(Passkey.user_id == user.id).all()
    options = generate_registration_options(
        rp_id=rp_id,
        rp_name=RP_NAME,
        # L'id utente dentro la passkey: un numero opaco, niente email.
        user_id=str(user.id).encode("utf-8"),
        user_name=user.email,
        user_display_name=user.username,
        # Una seconda passkey sullo stesso portachiavi non serve: il
        # dispositivo lo dice invece di crearne un doppione.
        exclude_credentials=[
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(p.credential_id))
            for p in esistenti
        ],
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.REQUIRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
    )
    _salva_sfida(db, options.challenge, "registrazione", user.id)
    return {"options": json.loads(options_to_json(options))}


@router.post("/register/verify", response_model=PasskeyOut)
@limiter.limit("10/minute")
def register_verify(
    payload: PasskeyRegisterVerify,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    challenge = _consuma_sfida(db, payload.credential, "registrazione", current_user_id)
    rp_id, origini = _relying_party()

    try:
        verificata = verify_registration_response(
            credential=payload.credential,
            expected_challenge=challenge,
            expected_rp_id=rp_id,
            expected_origin=origini,
            require_user_verification=True,
        )
    except Exception:
        logger.info("Registrazione passkey rifiutata per user_id=%s", current_user_id, exc_info=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=PASSKEY_NON_VALIDA)

    credential_id = bytes_to_base64url(verificata.credential_id)
    if db.query(Passkey).filter(Passkey.credential_id == credential_id).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Passkey already registered"
        )

    transports = payload.credential.get("response", {}).get("transports") or []
    nome = (payload.nome or "").strip() or _nome_dispositivo(
        request.headers.get("user-agent", "")
    )
    passkey = Passkey(
        user_id=current_user_id,
        credential_id=credential_id,
        public_key=verificata.credential_public_key,
        sign_count=verificata.sign_count,
        transports=",".join(str(t) for t in transports) or None,
        nome=nome[:60],
    )
    try:
        db.add(passkey)
        db.commit()
        db.refresh(passkey)
    except Exception:
        db.rollback()
        logger.exception("Salvataggio passkey fallito per user_id=%s", current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save the passkey",
        )
    return passkey


@router.post("/login/options", response_model=PasskeyOptionsOut)
@limiter.limit("20/minute")
def login_options(request: Request, db: Session = Depends(get_db)):
    rp_id, _ = _relying_party()
    # allow_credentials vuoto: è il dispositivo a proporre le passkey del sito,
    # senza che l'utente scriva chi è (e senza rivelare quali account esistono).
    options = generate_authentication_options(
        rp_id=rp_id,
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    _salva_sfida(db, options.challenge, "login", None)
    return {"options": json.loads(options_to_json(options))}


@router.post("/login/verify", response_model=Token)
@limiter.limit("10/minute;30/hour")
def login_verify(
    payload: PasskeyLoginVerify,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    challenge = _consuma_sfida(db, payload.credential, "login")
    rp_id, origini = _relying_party()

    passkey = (
        db.query(Passkey)
        .filter(Passkey.credential_id == str(payload.credential.get("id", "")))
        .with_for_update()
        .first()
    )
    if passkey is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=PASSKEY_NON_VALIDA)

    try:
        verificata = verify_authentication_response(
            credential=payload.credential,
            expected_challenge=challenge,
            expected_rp_id=rp_id,
            expected_origin=origini,
            credential_public_key=passkey.public_key,
            credential_current_sign_count=passkey.sign_count,
            require_user_verification=True,
        )
    except Exception:
        logger.info("Login con passkey %s rifiutato", passkey.id, exc_info=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=PASSKEY_NON_VALIDA)

    user = db.query(User).filter(User.id == passkey.user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=PASSKEY_NON_VALIDA)

    passkey.sign_count = verificata.new_sign_count
    passkey.last_used_at = _adesso()
    # Il commit di apri_sessione salva anche contatore e ultimo uso.
    return auth.apri_sessione(db, user, request, response)
