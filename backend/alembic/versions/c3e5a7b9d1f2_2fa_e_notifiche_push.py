"""verifica in due passaggi e notifiche push

- users: segreto TOTP (cifrato), flag di attivazione, ultimo intervallo usato;
  preferenze delle notifiche (budget, ricorrenze), accese di default;
- recovery_codes: codici di recupero monouso della 2FA (solo hash);
- push_subscriptions: i dispositivi che ricevono le notifiche;
- notifiche_inviate: quali notifiche sono già partite, per non ripeterle.

Colonne NOT NULL con server_default: gli utenti esistenti partono con la 2FA
spenta e le notifiche accese (che comunque arrivano solo ai dispositivi che le
attivano dalle Impostazioni).

Revision ID: c3e5a7b9d1f2
Revises: b2d4f6a8c0e1
Create Date: 2026-10-19 10:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3e5a7b9d1f2'
down_revision: Union[str, Sequence[str], None] = 'b2d4f6a8c0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('totp_secret', sa.String(), nullable=True))
    op.add_column(
        'users',
        sa.Column('totp_enabled', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column('users', sa.Column('totp_last_step', sa.Integer(), nullable=True))
    op.add_column(
        'users',
        sa.Column('notifica_budget', sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        'users',
        sa.Column('notifica_ricorrenze', sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.create_table(
        'recovery_codes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('code_hash', sa.String(length=64), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_recovery_codes_id', 'recovery_codes', ['id'])
    op.create_index('ix_recovery_codes_user_id', 'recovery_codes', ['user_id'])

    op.create_table(
        'push_subscriptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('endpoint', sa.String(), nullable=False),
        sa.Column('p256dh', sa.String(), nullable=False),
        sa.Column('auth', sa.String(), nullable=False),
        sa.Column('user_agent', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('endpoint'),
    )
    op.create_index('ix_push_subscriptions_id', 'push_subscriptions', ['id'])
    op.create_index('ix_push_subscriptions_user_id', 'push_subscriptions', ['user_id'])

    op.create_table(
        'notifiche_inviate',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('chiave', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'chiave', name='uq_notifiche_inviate_user_chiave'),
    )
    op.create_index('ix_notifiche_inviate_id', 'notifiche_inviate', ['id'])


def downgrade() -> None:
    op.drop_index('ix_notifiche_inviate_id', table_name='notifiche_inviate')
    op.drop_table('notifiche_inviate')
    op.drop_index('ix_push_subscriptions_user_id', table_name='push_subscriptions')
    op.drop_index('ix_push_subscriptions_id', table_name='push_subscriptions')
    op.drop_table('push_subscriptions')
    op.drop_index('ix_recovery_codes_user_id', table_name='recovery_codes')
    op.drop_index('ix_recovery_codes_id', table_name='recovery_codes')
    op.drop_table('recovery_codes')
    op.drop_column('users', 'notifica_ricorrenze')
    op.drop_column('users', 'notifica_budget')
    op.drop_column('users', 'totp_last_step')
    op.drop_column('users', 'totp_enabled')
    op.drop_column('users', 'totp_secret')
