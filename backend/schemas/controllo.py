from datetime import date
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, field_validator

from .transazione import TransazioneOut


class DoppioneOut(BaseModel):
    """Movimenti uguali: stesso conto, giorno, tipo, importo e descrizione."""

    data: date
    tipo: str
    importo: Decimal
    descrizione: str | None = None
    transazioni: List[TransazioneOut]


class NonDoppioniIn(BaseModel):
    """Gli id dei movimenti da non segnalare più come doppioni."""

    ids: List[int]


class QuadraturaCreate(BaseModel):
    conto_id: int
    data: date
    saldo_reale: Decimal

    @field_validator("saldo_reale", mode="after")
    @classmethod
    def round_money(cls, v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"))


class QuadraturaOut(BaseModel):
    """Una quadratura confrontata con la precedente dello stesso conto.

    La prima di un conto è il punto di partenza: `precedente_data`, `atteso` e
    `differenza` sono null. Per le altre `atteso` = reale della precedente +
    `movimenti_periodo` (l'effetto dei movimenti registrati tra le due date) e
    `differenza` = `atteso` - `saldo_reale`: positiva se l'app conta più soldi di
    quelli veri. `ultima` è la più recente del conto, l'unica che il controllo
    notturno guarda.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    conto_id: int
    conto_nome: str
    data: date
    saldo_reale: Decimal
    precedente_data: Optional[date] = None
    movimenti_periodo: Optional[Decimal] = None
    atteso: Optional[Decimal] = None
    differenza: Optional[Decimal] = None
    ultima: bool


__all__ = [
    "DoppioneOut",
    "NonDoppioniIn",
    "QuadraturaCreate",
    "QuadraturaOut",
]
