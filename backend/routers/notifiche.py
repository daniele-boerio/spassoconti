"""Notifiche push: preferenze e dispositivi iscritti.

L'iscrizione la fa il browser (service worker + PushManager), dopo che l'utente
ha concesso il permesso con un tocco: qui arriva l'oggetto `PushSubscription`
da salvare. L'invio è in services.invia_notifica, usato dai job.
"""

import logging
import os
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

import auth
from database import get_db
from models import PushSubscription, User
from rate_limit import limiter
from schemas import (
    NotificaProvaOut,
    NotificheOut,
    NotifichePreferenze,
    PushSubscriptionIn,
    PushSubscriptionRemove,
)
from services import invia_notifica, vapid_configurato

router = APIRouter(prefix="/notifiche", tags=["Notifiche"])

logger = logging.getLogger(__name__)


def _utente(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Your session may have expired",
        )
    return user


def _stato(db: Session, user: User) -> dict:
    disponibili = vapid_configurato()
    return {
        "disponibili": disponibili,
        "vapid_public_key": os.getenv("VAPID_PUBLIC_KEY") if disponibili else None,
        "budget": bool(user.notifica_budget),
        "ricorrenze": bool(user.notifica_ricorrenze),
        "dispositivi": db.query(PushSubscription)
        .filter(PushSubscription.user_id == user.id)
        .count(),
    }


@router.get("", response_model=NotificheOut)
def get_notifiche(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    return _stato(db, _utente(db, current_user_id))


@router.put("/preferenze", response_model=NotificheOut)
def update_preferenze(
    payload: NotifichePreferenze,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    user = _utente(db, current_user_id)
    campi = payload.model_dump(exclude_unset=True)
    try:
        if campi.get("budget") is not None:
            user.notifica_budget = campi["budget"]
        if campi.get("ricorrenze") is not None:
            user.notifica_ricorrenze = campi["ricorrenze"]
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Preferenze notifiche non salvate per user_id=%s", current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save the notification preferences",
        )
    return _stato(db, user)


@router.post("/dispositivi", response_model=NotificheOut)
def subscribe_dispositivo(
    payload: PushSubscriptionIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    """Salva (o aggiorna) il dispositivo. Idempotente: il FE lo richiama a ogni
    avvio, perché il browser può rinnovare l'iscrizione da sé."""
    if not vapid_configurato():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push notifications are not configured on the server",
        )
    if not payload.endpoint.startswith("https://"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid push endpoint",
        )

    user = _utente(db, current_user_id)
    try:
        # L'endpoint identifica il dispositivo, non l'account: se sul telefono
        # entra un altro utente, il dispositivo passa a lui (le notifiche del
        # precedente non devono più arrivarci).
        sub = (
            db.query(PushSubscription)
            .filter(PushSubscription.endpoint == payload.endpoint)
            .first()
        )
        if sub is None:
            sub = PushSubscription(endpoint=payload.endpoint)
            db.add(sub)
        sub.user_id = current_user_id
        sub.p256dh = payload.keys.p256dh
        sub.auth = payload.keys.auth
        sub.user_agent = (request.headers.get("user-agent") or "")[:255] or None
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Iscrizione push fallita per user_id=%s", current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not register this device for notifications",
        )
    return _stato(db, user)


@router.delete("/dispositivi", response_model=NotificheOut)
def unsubscribe_dispositivo(
    payload: PushSubscriptionRemove,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    """Toglie il dispositivo. Un endpoint sconosciuto non è un errore: lo stato
    finale ("questo dispositivo non riceve") è quello voluto."""
    user = _utente(db, current_user_id)
    db.query(PushSubscription).filter(
        PushSubscription.user_id == current_user_id,
        PushSubscription.endpoint == payload.endpoint,
    ).delete()
    db.commit()
    return _stato(db, user)


@router.post("/prova", response_model=NotificaProvaOut)
@limiter.limit("5/minute")
def invia_prova(
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    _utente(db, current_user_id)
    inviate = invia_notifica(
        db,
        current_user_id,
        "Notifiche attive",
        "Da qui arriveranno gli avvisi di SpassoConti.",
        url="/settings",
        tag="prova",
    )
    # invia_notifica può aver tolto dispositivi disiscritti.
    db.commit()
    return {"inviate": inviate}
