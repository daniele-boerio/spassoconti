"""quadrature (saldo reale a una data) e transazioni.non_doppione

Due aiuti al controllo dei conti, nessuno dei due sposta saldi:
- `quadrature`: l'utente dice quanto aveva davvero su un conto in un giorno; il
  controllo notturno confronta con il saldo che l'app ricostruisce per quel giorno.
- `transazioni.non_doppione`: "non è un doppione", per smettere di segnalare due
  movimenti uguali che sono giusti. Le righe esistenti partono da false.

Revision ID: c4e8f2a1d9b7
Revises: a7d3e9f1c2b4
Create Date: 2026-11-10 10:10:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4e8f2a1d9b7'
down_revision: Union[str, Sequence[str], None] = 'a7d3e9f1c2b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'transazioni',
        sa.Column('non_doppione', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        'quadrature',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('conto_id', sa.Integer(), sa.ForeignKey('conti.id', ondelete='CASCADE'), nullable=False),
        sa.Column('data', sa.Date(), nullable=False),
        sa.Column('saldo_reale', sa.Numeric(10, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_quadrature_id', 'quadrature', ['id'])
    op.create_index('ix_quadrature_user_id', 'quadrature', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_quadrature_user_id', table_name='quadrature')
    op.drop_index('ix_quadrature_id', table_name='quadrature')
    op.drop_table('quadrature')
    op.drop_column('transazioni', 'non_doppione')
