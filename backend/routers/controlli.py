"""Controlli che il confronto saldo/movimenti non copre: doppioni e quadrature.

Niente qui sposta un saldo. I doppioni si segnalano (e si possono segnare come
"non è un doppione"); una quadratura è il saldo vero di un conto in un giorno,
detto dall'utente, che il controllo notturno confronta con quello dell'app.
"""

from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

import auth
from database import get_db
from models import Conto, Quadratura
from schemas import (
    DoppioneOut,
    NonDoppioniIn,
    QuadraturaCreate,
    QuadraturaOut,
    TransazioneOut,
)
from schemas.transazione import TipoTransazione
from services import (
    movimenti_simili,
    segna_non_doppioni,
    stato_quadrature,
    trova_doppioni,
)

router = APIRouter(prefix="/controlli", tags=["Controlli"])


@router.get("/doppioni", response_model=list[DoppioneOut])
def get_doppioni(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    """Gruppi di movimenti uguali ancora da guardare. Lista vuota = nessuno."""
    return trova_doppioni(db, current_user_id)


@router.post("/doppioni/ignora", status_code=status.HTTP_204_NO_CONTENT)
def ignora_doppioni(
    payload: NonDoppioniIn,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    """"Non è un doppione": questi movimenti non vengono più segnalati."""
    try:
        segna_non_doppioni(db, current_user_id, payload.ids)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update duplicates",
        )


@router.get("/simili", response_model=list[TransazioneOut])
def get_simili(
    data: date,
    tipo: TipoTransazione,
    importo: Decimal = Query(..., gt=0),
    conto_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    """Movimenti già salvati con stesso giorno, tipo e importo: l'avviso prima di salvare."""
    return movimenti_simili(
        db, current_user_id, data, tipo.value if hasattr(tipo, "value") else tipo,
        importo.quantize(Decimal("0.01")), conto_id,
    )


@router.get("/quadrature", response_model=list[QuadraturaOut])
def get_quadrature(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    """Le quadrature, dalla più recente, con la differenza ricalcolata adesso."""
    return stato_quadrature(db, current_user_id)


@router.post("/quadrature", response_model=QuadraturaOut)
def create_quadratura(
    payload: QuadraturaCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    if payload.data > date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The date cannot be in the future",
        )
    conto = (
        db.query(Conto)
        .filter(
            Conto.id == payload.conto_id,
            Conto.user_id == current_user_id,
            Conto.deleted_at.is_(None),
        )
        .first()
    )
    if not conto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Account not found"
        )
    try:
        nuova = Quadratura(
            user_id=current_user_id,
            conto_id=conto.id,
            data=payload.data,
            saldo_reale=payload.saldo_reale,
        )
        db.add(nuova)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save the reconciliation",
        )
    return next(q for q in stato_quadrature(db, current_user_id) if q["id"] == nuova.id)


@router.delete("/quadrature/{quadratura_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quadratura(
    quadratura_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    riga = (
        db.query(Quadratura)
        .filter(Quadratura.id == quadratura_id, Quadratura.user_id == current_user_id)
        .first()
    )
    if not riga:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reconciliation not found"
        )
    try:
        db.delete(riga)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete the reconciliation",
        )
