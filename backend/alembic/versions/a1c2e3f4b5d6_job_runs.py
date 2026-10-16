"""job_runs: l'ultimo giro di ogni job notturno

Una riga per job (nome come chiave), riscritta a ogni esecuzione da
services.traccia_job e letta da GET /api/health/jobs. Tabella nuova e vuota:
nessun lock su tabelle esistenti.

Revision ID: a1c2e3f4b5d6
Revises: f7b8c9d0e1a2
Create Date: 2026-10-16 14:10:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c2e3f4b5d6'
down_revision: Union[str, Sequence[str], None] = 'f7b8c9d0e1a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'job_runs',
        sa.Column('nome', sa.String(), nullable=False),
        sa.Column('ultimo_avvio', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ultima_fine', sa.DateTime(timezone=True), nullable=True),
        sa.Column('esito', sa.String(), nullable=False),
        sa.Column('errori', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('problemi', sa.Integer(), nullable=True),
        sa.Column('messaggio', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('nome'),
    )


def downgrade() -> None:
    op.drop_table('job_runs')
