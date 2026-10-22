from datetime import date, datetime
from decimal import Decimal
from fastapi.params import Query
from pydantic import BaseModel, ConfigDict, Field, field_validator  # Usiamo ConfigDict
from typing import Literal, Optional


class TagBase(BaseModel):
    nome: str


class TagCreate(TagBase):
    pass


class TagUpdate(TagBase):
    pass


class TagOut(TagBase):
    id: int
    # Quante transazioni lo usano: serve a mostrare i tag per quanto pesano
    # invece che in ordine alfabetico e basta.
    n_transazioni: int = 0
    creationDate: datetime
    lastUpdate: datetime

    # Standard Pydantic V2
    model_config = ConfigDict(from_attributes=True)


class TransazioneAnteprima(BaseModel):
    """Riga dell'anteprima: le transazioni passate che finirebbero nel tag."""

    id: int
    data: Optional[date] = None
    descrizione: Optional[str] = None
    importo: Decimal

    @field_validator("importo", mode="after")
    @classmethod
    def round_importo(cls, v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"))


class TagSuggerimentoOut(BaseModel):
    """Tag proposto per una descrizione o per un gruppo di transazioni
    (services.suggerisci_tag / services.proposte_tag)."""

    # "esistente": tag che c'è già (tag_id valorizzato); "nuovo": da creare.
    tipo: Literal["esistente", "nuovo"]
    tag_id: Optional[int] = None
    nome: str
    # La frase normalizzata: va rimandata per "Non chiederlo più".
    chiave: str
    # La frase com'è scritta nella descrizione ("con la Gaia").
    frase: str
    # Volte in cui la frase è stata salvata con il tag ("esistente") o
    # transazioni senza tag che la contengono ("nuovo", pulizia in blocco).
    occorrenze: int
    transazioni: list[TransazioneAnteprima] = []


class TagApplica(BaseModel):
    """Mette un tag sulle transazioni scelte: esistente (`tag_id`) o per nome,
    creato se non c'è."""

    tag_id: Optional[int] = None
    nome: Optional[str] = Field(None, max_length=100)
    transazione_ids: list[int] = Field(default_factory=list, max_length=1000)


class TagApplicaOut(BaseModel):
    tag: TagOut
    # Quante transazioni hanno preso il tag (quelle che ne avevano già uno no).
    aggiornate: int


class TagRifiuta(BaseModel):
    """"Non chiederlo più" per questa coppia frase/tag."""

    chiave: str = Field(..., max_length=100)
    nome: str = Field(..., max_length=100)


class TagFilters:
    def __init__(
        self,
        # Default ordinamento per nome ascendente
        sort_by: Optional[list[str]] = Query(["nome:asc"]),
        nome: Optional[str] = Query(
            None
        ),  # Aggiunto filtro per nome se volessi cercarne uno specifico
    ):
        self.sort_by = sort_by
        self.nome = nome

    def model_dump(self):
        return {k: v for k, v in self.__dict__.items() if v is not None}
