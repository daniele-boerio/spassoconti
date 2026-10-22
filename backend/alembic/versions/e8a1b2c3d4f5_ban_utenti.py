"""ban degli utenti dall'admin

- users.banned_at: quando l'admin ha bloccato l'accesso. NULL = utente attivo.

Colonna nullable senza default: su Postgres è solo metadato, nessuna
riscrittura della tabella.

Revision ID: e8a1b2c3d4f5
Revises: d4f6b8c0e2a3
Create Date: 2026-10-22 10:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8a1b2c3d4f5'
down_revision: Union[str, Sequence[str], None] = 'd4f6b8c0e2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('banned_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'banned_at')
