"""users.ricorda_ultimo_tag: interruttore per preselezionare l'ultimo tag

Spento di default (anche per gli utenti esistenti): il tag ricordato finiva
sulle spese successive che non c'entravano. Si accende dalle Impostazioni.
Con lui spento last_tag_id non serve più: si azzera, così riaccendendo si
riparte dal prossimo tag scelto.

Server_default costante: su Postgres 11+ è solo metadato.

Revision ID: 0701566ad5a2
Revises: c4e8f2a1d9b7
Create Date: 2026-11-18 14:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0701566ad5a2'
down_revision: Union[str, Sequence[str], None] = 'c4e8f2a1d9b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('ricorda_ultimo_tag', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute("UPDATE users SET last_tag_id = NULL")


def downgrade() -> None:
    op.drop_column('users', 'ricorda_ultimo_tag')
