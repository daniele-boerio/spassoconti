"""ricorrenze.giorno_riferimento: il giorno del mese a cui tornano le rate

Senza, una ricorrenza mensile sul 31 dopo settembre restava al 30 per sempre
(si sommava un mese alla data precedente). La colonna è nullable e le righe
esistenti prendono il giorno della loro prossima esecuzione: quelle già
scivolate (es. al 30) restano lì finché l'utente non sceglie di nuovo la data.

Revision ID: a7d3e9f1c2b4
Revises: f9b2c3d4e5a6
Create Date: 2026-11-01 23:30:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7d3e9f1c2b4'
down_revision: Union[str, Sequence[str], None] = 'f9b2c3d4e5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'ricorrenze', sa.Column('giorno_riferimento', sa.Integer(), nullable=True)
    )

    if op.get_bind().dialect.name == 'postgresql':
        giorno = "EXTRACT(DAY FROM prossima_esecuzione)::int"
    else:
        giorno = "CAST(strftime('%d', prossima_esecuzione) AS INTEGER)"
    op.execute(f"UPDATE ricorrenze SET giorno_riferimento = {giorno}")


def downgrade() -> None:
    op.drop_column('ricorrenze', 'giorno_riferimento')
