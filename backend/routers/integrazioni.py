"""SpassoSpesa: la lista della spesa condivisa di casa registra qui le spese fatte.

È una chiamata da server a server: niente sessione né OAuth, ma un token condiviso
(`SPASSOSPESA_TOKEN`, lo stesso valore impostato su SpassoSpesa) e la mail
dell'utente per cui si agisce. Lo scoping per utente sta tutto qui: dalla mail si
risale all'utente (non bannato), e da lì ogni conto, categoria e movimento passa dagli
stessi controlli delle rotte normali — il movimento si crea chiamando
`create_transazione`, quindi saldo, idempotenza e verifica dei saldi sono quelli di
sempre. Senza token configurato le rotte rispondono 404, come se non esistessero.

- `GET /account?email=` — c'è un utente con questa mail? Con i suoi conti e le
  categorie di uscita, per scegliere dove registrare la spesa.
- `POST /transazioni` — un'uscita (lo scontrino) o un rimborso su quell'uscita (la
  metà che l'altro ha restituito). Solo questi due tipi.
"""

import logging
import os
import secrets
from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models import Categoria, Conto, User
from routers.transazioni import create_transazione
from schemas.transazione import TransazioneCreate, TipoTransazione

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrazioni/spassospesa", tags=["Integrazioni"])


def _servizio(authorization: Optional[str] = Header(default=None)) -> None:
    token = (os.getenv("SPASSOSPESA_TOKEN") or "").strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")
    given = (authorization or "").removeprefix("Bearer ").strip()
    if not secrets.compare_digest(given.encode(), token.encode()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def _utente(db: Session, email: str) -> Optional[User]:
    email = (email or "").strip().lower()
    if not email:
        return None
    user = db.query(User).filter(User.email.ilike(email)).first()
    if user is None or user.banned_at is not None:
        return None
    return user


@router.get("/account", dependencies=[Depends(_servizio)])
def account(email: str, db: Session = Depends(get_db)):
    user = _utente(db, email)
    if user is None:
        return {"exists": False}
    conti = (
        db.query(Conto)
        .filter(Conto.user_id == user.id, Conto.deleted_at.is_(None))
        .order_by(Conto.default.desc(), Conto.nome)
        .all()
    )
    categorie = (
        db.query(Categoria)
        .options(selectinload(Categoria.sottocategorie))
        .filter(Categoria.user_id == user.id)
        .order_by(Categoria.nome)
        .all()
    )
    return {
        "exists": True,
        "conti": [
            {"id": c.id, "nome": c.nome, "color": c.color, "virtuale": bool(c.virtuale)}
            for c in conti
        ],
        "categorie": [
            {
                "id": c.id,
                "nome": c.nome,
                "sottocategorie": [
                    {"id": s.id, "nome": s.nome}
                    for s in c.sottocategorie
                    if s.solo_uscita is not False
                ],
            }
            for c in categorie
            if c.solo_uscita is not False
        ],
    }


class MovimentoSpesa(BaseModel):
    email: str
    tipo: Literal["USCITA", "RIMBORSO"]
    importo: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    data: date
    descrizione: Optional[str] = Field(default=None, max_length=200)
    conto_id: int
    categoria_id: Optional[int] = None
    sottocategoria_id: Optional[int] = None
    parent_transaction_id: Optional[int] = None
    idempotency_key: str = Field(min_length=8, max_length=64)

    @field_validator("importo", mode="after")
    @classmethod
    def round_importo(cls, v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"))


@router.post("/transazioni", dependencies=[Depends(_servizio)])
def crea_movimento(body: MovimentoSpesa, db: Session = Depends(get_db)):
    user = _utente(db, body.email)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if body.tipo == "RIMBORSO" and not body.parent_transaction_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A refund needs the original transaction",
        )
    payload = TransazioneCreate(
        importo=body.importo,
        tipo=TipoTransazione(body.tipo),
        data=body.data,
        descrizione=body.descrizione,
        conto_id=body.conto_id,
        categoria_id=body.categoria_id if body.tipo == "USCITA" else None,
        sottocategoria_id=body.sottocategoria_id if body.tipo == "USCITA" else None,
        parent_transaction_id=body.parent_transaction_id if body.tipo == "RIMBORSO" else None,
    )
    # Stessa rotta dell'app: conto e tassonomia verificati sull'utente, saldo col
    # lock, idempotenza sulla chiave (SpassoSpesa può riprovare dopo un timeout).
    tx = create_transazione(
        payload,
        db=db,
        current_user_id=user.id,
        idempotency_key=body.idempotency_key,
    )
    return {"id": tx.id, "importo": str(tx.importo), "tipo": tx.tipo}
