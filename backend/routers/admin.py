"""Area admin: chi ha accesso all'app e ban degli utenti.

Unica eccezione voluta alla regola "ogni query è filtrata per user_id": qui
l'admin legge e modifica gli altri utenti. Il cancello è
`auth.get_app_admin_user_id` (ADMIN_EMAIL), su ogni endpoint.

Il ban non cancella nulla: profilo, conti e transazioni restano e tornano
accessibili se il ban viene tolto.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import auth
from database import get_db
from models import User
from schemas import AdminUserOut

router = APIRouter(prefix="/admin", tags=["Admin"])

logger = logging.getLogger(__name__)


def _out(user: User) -> AdminUserOut:
    out = AdminUserOut.model_validate(user)
    out.is_admin = auth.is_admin(user)
    return out


def _utente_da_gestire(db: Session, user_id: int, admin_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).with_for_update().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    # L'admin che si banna da solo resterebbe chiuso fuori senza rimedio dall'app.
    if user.id == admin_id or auth.is_admin(user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The administrator cannot be banned",
        )
    return user


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    db: Session = Depends(get_db),
    admin_id: int = Depends(auth.get_app_admin_user_id),
):
    """Tutti gli utenti registrati, bannati compresi, dal più vecchio."""
    return [_out(u) for u in db.query(User).order_by(User.id).all()]


@router.post("/users/{user_id}/ban", response_model=AdminUserOut)
def ban_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_id: int = Depends(auth.get_app_admin_user_id),
):
    """Blocca l'accesso e chiude subito tutte le sessioni dell'utente.

    - refresh token revocati: nessun dispositivo rinnova la sessione;
    - token_version +1: gli access token già emessi smettono di valere ora,
      non alla loro scadenza naturale (stesso meccanismo di /auth/logout-all).
    """
    user = _utente_da_gestire(db, user_id, admin_id)
    if user.banned_at is None:
        try:
            user.banned_at = datetime.now(timezone.utc)
            user.token_version = (user.token_version or 1) + 1
            auth.revoke_all_user_tokens(db, user.id)
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()
            logger.exception("Ban fallito per user_id=%s", user_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not ban the user",
            )
        logger.info("Utente %s bannato dall'admin %s", user_id, admin_id)
    return _out(user)


@router.post("/users/{user_id}/unban", response_model=AdminUserOut)
def unban_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_id: int = Depends(auth.get_app_admin_user_id),
):
    """Toglie il ban: l'utente rientra con le sue credenziali di sempre."""
    user = _utente_da_gestire(db, user_id, admin_id)
    if user.banned_at is not None:
        try:
            user.banned_at = None
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()
            logger.exception("Rimozione del ban fallita per user_id=%s", user_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not unban the user",
            )
        logger.info("Ban tolto all'utente %s dall'admin %s", user_id, admin_id)
    return _out(user)
