from typing import Optional
from pydantic import BaseModel, Field


class NotificheOut(BaseModel):
    # False se il server non ha le chiavi VAPID: il FE nasconde l'attivazione.
    disponibili: bool
    vapid_public_key: Optional[str] = None
    budget: bool
    ricorrenze: bool
    # Quanti dispositivi dell'utente le ricevono.
    dispositivi: int


class NotifichePreferenze(BaseModel):
    """Aggiornamento parziale: i campi non inviati restano com'erano."""

    budget: Optional[bool] = None
    ricorrenze: Optional[bool] = None


class PushKeys(BaseModel):
    p256dh: str = Field(..., max_length=200)
    auth: str = Field(..., max_length=100)


class PushSubscriptionIn(BaseModel):
    """Lo stesso oggetto che dà `PushSubscription.toJSON()` nel browser."""

    endpoint: str = Field(..., max_length=1000)
    keys: PushKeys


class PushSubscriptionRemove(BaseModel):
    endpoint: str = Field(..., max_length=1000)


class NotificaProvaOut(BaseModel):
    inviate: int
