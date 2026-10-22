"""suggerimenti di tag dalla descrizione

- tag_proposte_rifiutate: le proposte di tag a cui l'utente ha risposto "Non
  chiederlo più", per non ripeterle;
- users.suggerimenti_tag: interruttore delle Impostazioni (default acceso).

La tabella è nuova e vuota. La colonna ha un server_default costante: su
Postgres 11+ è solo metadato, nessuna riscrittura di users.

Revision ID: f9b2c3d4e5a6
Revises: e8a1b2c3d4f5
Create Date: 2026-10-22 21:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f9b2c3d4e5a6'
down_revision: Union[str, Sequence[str], None] = 'e8a1b2c3d4f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'suggerimenti_tag', sa.Boolean(), nullable=False, server_default=sa.true()
        ),
    )
    op.create_table(
        'tag_proposte_rifiutate',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('frase', sa.String(length=100), nullable=False),
        sa.Column('nome', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'frase', 'nome'),
    )
    op.create_index(
        op.f('ix_tag_proposte_rifiutate_id'), 'tag_proposte_rifiutate', ['id'], unique=False
    )
    op.create_index(
        op.f('ix_tag_proposte_rifiutate_user_id'),
        'tag_proposte_rifiutate',
        ['user_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_tag_proposte_rifiutate_user_id'), table_name='tag_proposte_rifiutate')
    op.drop_index(op.f('ix_tag_proposte_rifiutate_id'), table_name='tag_proposte_rifiutate')
    op.drop_table('tag_proposte_rifiutate')
    op.drop_column('users', 'suggerimenti_tag')
