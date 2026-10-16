"""indici per le query frequenti e le FK scoperte

- ix_transazioni_attive_user_data: (user_id, data) solo sui movimenti non
  cancellati, che sono quelli che liste, export e statistiche leggono;
- ix_transazioni_user_categoria / _user_tag: filtri e raggruppamenti;
- ix_ricorrenze_conto_id / ix_bank_proposals_conto_id: FK senza indice;
- ix_refresh_tokens_expires_at: pulizia notturna dei token scaduti.

Solo CREATE INDEX: le tabelle oggi sono piccole (dump ~100 KB) e l'indice si
costruisce in millisecondi. Con tabelle grandi andrebbe usato
postgresql_concurrently=True dentro op.get_context().autocommit_block().

Revision ID: b2d4f6a8c0e1
Revises: a1c2e3f4b5d6
Create Date: 2026-10-16 15:30:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2d4f6a8c0e1'
down_revision: Union[str, Sequence[str], None] = 'a1c2e3f4b5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'ix_transazioni_attive_user_data',
        'transazioni',
        ['user_id', 'data'],
        postgresql_where=sa.text('deleted_at IS NULL'),
    )
    op.create_index(
        'ix_transazioni_user_categoria', 'transazioni', ['user_id', 'categoria_id']
    )
    op.create_index('ix_transazioni_user_tag', 'transazioni', ['user_id', 'tag_id'])
    op.create_index('ix_ricorrenze_conto_id', 'ricorrenze', ['conto_id'])
    op.create_index(
        'ix_bank_proposals_conto_id', 'bank_transaction_proposals', ['conto_id']
    )
    op.create_index('ix_refresh_tokens_expires_at', 'refresh_tokens', ['expires_at'])


def downgrade() -> None:
    op.drop_index('ix_refresh_tokens_expires_at', table_name='refresh_tokens')
    op.drop_index('ix_bank_proposals_conto_id', table_name='bank_transaction_proposals')
    op.drop_index('ix_ricorrenze_conto_id', table_name='ricorrenze')
    op.drop_index('ix_transazioni_user_tag', table_name='transazioni')
    op.drop_index('ix_transazioni_user_categoria', table_name='transazioni')
    op.drop_index('ix_transazioni_attive_user_data', table_name='transazioni')
