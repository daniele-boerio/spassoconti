import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from database import get_db
import auth
from models import Tag, Transazione
from sqlalchemy import func
from schemas import (
    TagApplica,
    TagApplicaOut,
    TagCreate,
    TagFilters,
    TagOut,
    TagRifiuta,
    TagSuggerimentoOut,
    TagUpdate,
)
from services import (
    applica_tag,
    apply_filters_and_sort,
    proposte_tag,
    rifiuta_proposta_tag,
    suggerisci_tag,
)

router = APIRouter(prefix="/tags", tags=["Tag"])

logger = logging.getLogger(__name__)

# --- ENDPOINT TAG ---


@router.post("", response_model=TagOut)
def create_tag(
    tag: TagCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    # Check if tag with the same name already exists for this user
    existing_tag = (
        db.query(Tag)
        .filter(Tag.nome == tag.nome, Tag.user_id == current_user_id)
        .first()
    )

    if existing_tag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A tag with this name already exists",
        )

    try:
        new_tag = Tag(nome=tag.nome, user_id=current_user_id)
        db.add(new_tag)
        db.commit()
        db.refresh(new_tag)
        return new_tag
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the tag",
        )


@router.get("", response_model=list[TagOut])
def get_tags(
    db: Session = Depends(get_db),
    filters: TagFilters = Depends(),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    query = db.query(Tag).filter(Tag.user_id == current_user_id)
    query = apply_filters_and_sort(
        query,
        Tag,
        filters=filters,
    )

    tags = query.all()

    # Un COUNT solo per tutti i tag, non uno per tag: la lista è corta ma
    # crescerebbe, e N+1 query su una schermata di sola lettura non si fanno.
    conteggi = dict(
        db.query(Transazione.tag_id, func.count(Transazione.id))
        .filter(
            Transazione.user_id == current_user_id,
            Transazione.deleted_at.is_(None),
            Transazione.tag_id.isnot(None),
        )
        .group_by(Transazione.tag_id)
        .all()
    )

    return [
        TagOut.model_validate(tag).model_copy(
            update={"n_transazioni": conteggi.get(tag.id, 0)}
        )
        for tag in tags
    ]


@router.get("/suggerimento", response_model=Optional[TagSuggerimentoOut])
def get_tag_suggerimento(
    descrizione: str = Query(..., max_length=200),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    """Il tag da proporre al salvataggio di una transazione, o null.

    Impara dalla storia dell'utente (services.suggerisci_tag). Null anche se
    l'utente ha spento i suggerimenti dalle Impostazioni.
    """
    return suggerisci_tag(db, current_user_id, descrizione)


@router.get("/proposte", response_model=list[TagSuggerimentoOut])
def get_tag_proposte(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    """Pulizia in blocco: gruppi di transazioni senza tag con una frase in
    comune ("con paolo") e il tag da usare (services.proposte_tag)."""
    return proposte_tag(db, current_user_id)


@router.post("/applica", response_model=TagApplicaOut)
def post_tag_applica(
    payload: TagApplica,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    """Mette un tag (esistente o nuovo) sulle transazioni scelte nell'anteprima.

    Tocca solo transazioni dell'utente ancora senza tag.
    """
    try:
        tag, aggiornate = applica_tag(
            db,
            current_user_id,
            payload.transazione_ids,
            tag_id=payload.tag_id,
            nome=payload.nome,
        )
    except ValueError as exc:
        db.rollback()
        status_code = (
            status.HTTP_404_NOT_FOUND
            if str(exc) == "Tag not found"
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=str(exc))

    try:
        db.commit()
        db.refresh(tag)
    except Exception:
        db.rollback()
        logger.exception("Applicazione del tag fallita per user_id=%s", current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while applying the tag",
        )

    n_transazioni = (
        db.query(func.count(Transazione.id))
        .filter(
            Transazione.user_id == current_user_id,
            Transazione.deleted_at.is_(None),
            Transazione.tag_id == tag.id,
        )
        .scalar()
    )
    return {
        "tag": TagOut.model_validate(tag).model_copy(
            update={"n_transazioni": n_transazioni}
        ),
        "aggiornate": aggiornate,
    }


@router.post("/proposte/rifiuta", status_code=status.HTTP_204_NO_CONTENT)
def post_tag_proposta_rifiuta(
    payload: TagRifiuta,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    """"Non chiederlo più": la coppia frase/tag non verrà più proposta."""
    try:
        rifiuta_proposta_tag(db, current_user_id, payload.chiave, payload.nome)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Rifiuto della proposta fallito per user_id=%s", current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while saving the preference",
        )


@router.put("/{tag_id}", response_model=TagOut)
def update_tag(
    tag_id: int,
    tag_data: TagUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    db_tag = (
        db.query(Tag).filter(Tag.id == tag_id, Tag.user_id == current_user_id).first()
    )

    if not db_tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found or not authorized",
        )

    try:
        db_tag.nome = tag_data.nome
        db.commit()
        db.refresh(db_tag)
        return db_tag
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update the tag",
        )


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(
    tag_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(auth.get_current_user_id),
):
    db_tag = (
        db.query(Tag).filter(Tag.id == tag_id, Tag.user_id == current_user_id).first()
    )

    if not db_tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found or not authorized",
        )

    try:
        db.delete(db_tag)
        db.commit()
        return
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while deleting the tag. It might be in use by some transactions",
        )
