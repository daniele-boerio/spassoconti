"""passkey (WebAuthn) per l'accesso biometrico

- passkeys: le chiavi pubbliche registrate da ogni utente (Face ID, impronta…);
- webauthn_challenges: le sfide delle cerimonie in corso, monouso e a
  scadenza breve (le pulisce il job notturno dei token).

Tabelle nuove e vuote: nessun lock su tabelle esistenti.

Revision ID: d4f6b8c0e2a3
Revises: c3e5a7b9d1f2
Create Date: 2026-10-19 22:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4f6b8c0e2a3'
down_revision: Union[str, Sequence[str], None] = 'c3e5a7b9d1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'passkeys',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('credential_id', sa.String(), nullable=False),
        sa.Column('public_key', sa.LargeBinary(), nullable=False),
        sa.Column('sign_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('transports', sa.String(), nullable=True),
        sa.Column('nome', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('credential_id'),
    )
    op.create_index('ix_passkeys_id', 'passkeys', ['id'])
    op.create_index('ix_passkeys_user_id', 'passkeys', ['user_id'])

    op.create_table(
        'webauthn_challenges',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('challenge', sa.String(), nullable=False),
        sa.Column('tipo', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('challenge'),
    )
    op.create_index('ix_webauthn_challenges_id', 'webauthn_challenges', ['id'])


def downgrade() -> None:
    op.drop_index('ix_webauthn_challenges_id', table_name='webauthn_challenges')
    op.drop_table('webauthn_challenges')
    op.drop_index('ix_passkeys_user_id', table_name='passkeys')
    op.drop_index('ix_passkeys_id', table_name='passkeys')
    op.drop_table('passkeys')
