"""initial schema: all tables, indexes, pgvector extension + HNSW index

Revision ID: 0001
Revises: 
Create Date: 2026-10-02
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

import app.db.types
from app.core.config import get_settings

revision: str = '0001'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _sqlite() -> bool:
    return op.get_bind().dialect.name == "sqlite"


def _pgvector() -> bool:
    return op.get_bind().dialect.name == "postgresql" and get_settings().pgvector_enabled


def upgrade() -> None:
    if _pgvector():
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table('organizations',
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('slug', sa.String(length=120), nullable=False),
    sa.Column('plan', sa.String(length=40), nullable=False),
    sa.Column('seats', sa.Integer(), nullable=False),
    sa.Column('settings', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_organizations'))
    )
    with op.batch_alter_table('organizations', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_organizations_slug'), ['slug'], unique=True)

    op.create_table('users',
    sa.Column('email', sa.String(length=320), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('avatar_url', sa.String(length=1000), nullable=True),
    sa.Column('password_hash', sa.String(length=255), nullable=True),
    sa.Column('auth_provider', sa.String(length=40), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_users'))
    )
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_users_email'), ['email'], unique=True)

    op.create_table('ai_generations',
    sa.Column('organization_id', sa.Uuid(), nullable=True),
    sa.Column('user_id', sa.Uuid(), nullable=True),
    sa.Column('task', sa.String(length=60), nullable=False),
    sa.Column('provider', sa.String(length=40), nullable=False),
    sa.Column('model', sa.String(length=120), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('attempts', sa.Integer(), nullable=False),
    sa.Column('latency_ms', sa.Integer(), nullable=False),
    sa.Column('prompt_tokens', sa.Integer(), nullable=True),
    sa.Column('completion_tokens', sa.Integer(), nullable=True),
    sa.Column('error', sa.Text(), nullable=True),
    sa.Column('metadata', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_ai_generations_organization_id_organizations'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_ai_generations_user_id_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_ai_generations'))
    )
    with op.batch_alter_table('ai_generations', schema=None) as batch_op:
        batch_op.create_index('ix_ai_generations_org_created', ['organization_id', 'created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_ai_generations_task'), ['task'], unique=False)

    op.create_table('api_keys',
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('prefix', sa.String(length=16), nullable=False),
    sa.Column('key_hash', sa.String(length=128), nullable=False),
    sa.Column('created_by', sa.Uuid(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_api_keys_created_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_api_keys_organization_id_organizations'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_api_keys')),
    sa.UniqueConstraint('key_hash', name=op.f('uq_api_keys_key_hash'))
    )
    with op.batch_alter_table('api_keys', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_api_keys_organization_id'), ['organization_id'], unique=False)

    op.create_table('audit_logs',
    sa.Column('organization_id', sa.Uuid(), nullable=True),
    sa.Column('user_id', sa.Uuid(), nullable=True),
    sa.Column('action', sa.String(length=80), nullable=False),
    sa.Column('resource', sa.String(length=40), nullable=True),
    sa.Column('resource_id', sa.String(length=64), nullable=True),
    sa.Column('metadata', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('ip_address', sa.String(length=64), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_audit_logs_organization_id_organizations'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_audit_logs_user_id_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_audit_logs'))
    )
    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.create_index('ix_audit_org_created', ['organization_id', 'created_at'], unique=False)

    op.create_table('auth_sessions',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('user_agent', sa.String(length=500), nullable=True),
    sa.Column('ip_address', sa.String(length=64), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_auth_sessions_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_auth_sessions'))
    )
    with op.batch_alter_table('auth_sessions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_auth_sessions_user_id'), ['user_id'], unique=False)

    op.create_table('documents',
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.Column('filename', sa.String(length=300), nullable=False),
    sa.Column('title', sa.String(length=300), nullable=False),
    sa.Column('category', sa.String(length=40), nullable=False),
    sa.Column('mime_type', sa.String(length=120), nullable=False),
    sa.Column('size_bytes', sa.BigInteger(), nullable=False),
    sa.Column('storage_key', sa.String(length=500), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('extracted_text', sa.Text(), nullable=True),
    sa.Column('summary', sa.Text(), nullable=True),
    sa.Column('metadata', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('uploaded_by', sa.Uuid(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_documents_organization_id_organizations'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], name=op.f('fk_documents_uploaded_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_documents'))
    )
    with op.batch_alter_table('documents', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_documents_created_at'), ['created_at'], unique=False)
        batch_op.create_index('ix_documents_org_category', ['organization_id', 'category'], unique=False)
        batch_op.create_index(batch_op.f('ix_documents_organization_id'), ['organization_id'], unique=False)

    op.create_table('favorites',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.Column('resource_type', sa.String(length=30), nullable=False),
    sa.Column('resource_id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_favorites_organization_id_organizations'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_favorites_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_favorites')),
    sa.UniqueConstraint('user_id', 'resource_type', 'resource_id', name='uq_favorite_user_resource')
    )
    with op.batch_alter_table('favorites', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_favorites_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_favorites_resource_id'), ['resource_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_favorites_user_id'), ['user_id'], unique=False)

    op.create_table('folders',
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_folders_organization_id_organizations'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_folders')),
    sa.UniqueConstraint('organization_id', 'kind', 'name', name='uq_folder_org_kind_name')
    )
    with op.batch_alter_table('folders', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_folders_organization_id'), ['organization_id'], unique=False)

    op.create_table('invitations',
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.Column('email', sa.String(length=320), nullable=False),
    sa.Column('role', sa.String(length=20), nullable=False),
    sa.Column('department', sa.String(length=120), nullable=True),
    sa.Column('token_hash', sa.String(length=128), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('invited_by', sa.Uuid(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['invited_by'], ['users.id'], name=op.f('fk_invitations_invited_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_invitations_organization_id_organizations'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_invitations')),
    sa.UniqueConstraint('token_hash', name=op.f('uq_invitations_token_hash'))
    )
    with op.batch_alter_table('invitations', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_invitations_email'), ['email'], unique=False)
        batch_op.create_index(batch_op.f('ix_invitations_organization_id'), ['organization_id'], unique=False)

    op.create_table('jobs',
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.Column('type', sa.String(length=50), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('progress', sa.Integer(), nullable=False),
    sa.Column('step', sa.String(length=200), nullable=True),
    sa.Column('resource_type', sa.String(length=30), nullable=True),
    sa.Column('resource_id', sa.Uuid(), nullable=True),
    sa.Column('payload', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('result', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('error', sa.Text(), nullable=True),
    sa.Column('created_by', sa.Uuid(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_jobs_created_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_jobs_organization_id_organizations'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_jobs'))
    )
    with op.batch_alter_table('jobs', schema=None) as batch_op:
        batch_op.create_index('ix_jobs_org_status', ['organization_id', 'status'], unique=False)
        batch_op.create_index(batch_op.f('ix_jobs_organization_id'), ['organization_id'], unique=False)

    op.create_table('meetings',
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.Column('title', sa.String(length=300), nullable=False),
    sa.Column('agenda', sa.Text(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('language', sa.String(length=10), nullable=False),
    sa.Column('location', sa.String(length=200), nullable=True),
    sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('duration_seconds', sa.Integer(), nullable=True),
    sa.Column('created_by', sa.Uuid(), nullable=True),
    sa.Column('stt_provider', sa.String(length=40), nullable=True),
    sa.Column('audio_meta', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('summary', sa.Text(), nullable=True),
    sa.Column('intelligence', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('notes', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('presentation_id', sa.Uuid(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_meetings_created_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_meetings_organization_id_organizations'), ondelete='CASCADE'),
    *([sa.ForeignKeyConstraint(['presentation_id'], ['presentations.id'], name=op.f('fk_meetings_presentation_id_presentations'), ondelete='SET NULL')] if _sqlite() else []),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_meetings'))
    )
    with op.batch_alter_table('meetings', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_meetings_created_at'), ['created_at'], unique=False)
        batch_op.create_index('ix_meetings_org_started', ['organization_id', 'started_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_meetings_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_meetings_status'), ['status'], unique=False)

    op.create_table('memberships',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.Column('role', sa.String(length=20), nullable=False),
    sa.Column('department', sa.String(length=120), nullable=True),
    sa.Column('title', sa.String(length=120), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_active_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_memberships_organization_id_organizations'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_memberships_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_memberships')),
    sa.UniqueConstraint('user_id', 'organization_id', name='uq_membership_user_org')
    )
    with op.batch_alter_table('memberships', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_memberships_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_memberships_user_id'), ['user_id'], unique=False)

    op.create_table('share_links',
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.Column('resource_type', sa.String(length=30), nullable=False),
    sa.Column('resource_id', sa.Uuid(), nullable=False),
    sa.Column('token', sa.String(length=64), nullable=False),
    sa.Column('audience', sa.String(length=20), nullable=False),
    sa.Column('allow_download', sa.Boolean(), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=True),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('view_count', sa.Integer(), nullable=False),
    sa.Column('created_by', sa.Uuid(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_share_links_created_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_share_links_organization_id_organizations'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_share_links'))
    )
    with op.batch_alter_table('share_links', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_share_links_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index('ix_share_links_resource', ['resource_type', 'resource_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_share_links_token'), ['token'], unique=True)

    op.create_table('templates',
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('category', sa.String(length=40), nullable=False),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('schema', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('source', sa.String(length=20), nullable=False),
    sa.Column('approved', sa.Boolean(), nullable=False),
    sa.Column('usage_count', sa.Integer(), nullable=False),
    sa.Column('created_by', sa.Uuid(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_templates_created_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_templates_organization_id_organizations'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_templates'))
    )
    with op.batch_alter_table('templates', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_templates_created_at'), ['created_at'], unique=False)
        batch_op.create_index('ix_templates_org_category', ['organization_id', 'category'], unique=False)
        batch_op.create_index(batch_op.f('ix_templates_organization_id'), ['organization_id'], unique=False)

    op.create_table('action_items',
    sa.Column('meeting_id', sa.Uuid(), nullable=False),
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.Column('title', sa.String(length=500), nullable=False),
    sa.Column('owner', sa.String(length=200), nullable=True),
    sa.Column('deadline', sa.Date(), nullable=True),
    sa.Column('deadline_text', sa.String(length=100), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['meeting_id'], ['meetings.id'], name=op.f('fk_action_items_meeting_id_meetings'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_action_items_organization_id_organizations'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_action_items'))
    )
    with op.batch_alter_table('action_items', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_action_items_meeting_id'), ['meeting_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_action_items_organization_id'), ['organization_id'], unique=False)

    op.create_table('assets',
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.Column('folder_id', sa.Uuid(), nullable=True),
    sa.Column('filename', sa.String(length=300), nullable=False),
    sa.Column('name', sa.String(length=300), nullable=False),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('mime_type', sa.String(length=120), nullable=False),
    sa.Column('size_bytes', sa.BigInteger(), nullable=False),
    sa.Column('storage_key', sa.String(length=500), nullable=False),
    sa.Column('metadata', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('uploaded_by', sa.Uuid(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['folder_id'], ['folders.id'], name=op.f('fk_assets_folder_id_folders'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_assets_organization_id_organizations'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], name=op.f('fk_assets_uploaded_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_assets'))
    )
    with op.batch_alter_table('assets', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_assets_created_at'), ['created_at'], unique=False)
        batch_op.create_index('ix_assets_org_type', ['organization_id', 'type'], unique=False)
        batch_op.create_index(batch_op.f('ix_assets_organization_id'), ['organization_id'], unique=False)

    op.create_table('document_chunks',
    sa.Column('document_id', sa.Uuid(), nullable=False),
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.Column('chunk_index', sa.Integer(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('token_count', sa.Integer(), nullable=False),
    sa.Column('embedding', app.db.types.Embedding(), nullable=True),
    sa.Column('metadata', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], name=op.f('fk_document_chunks_document_id_documents'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_document_chunks_organization_id_organizations'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_document_chunks'))
    )
    with op.batch_alter_table('document_chunks', schema=None) as batch_op:
        batch_op.create_index('ix_chunks_document_index', ['document_id', 'chunk_index'], unique=False)
        batch_op.create_index(batch_op.f('ix_document_chunks_organization_id'), ['organization_id'], unique=False)

    op.create_table('meeting_insights',
    sa.Column('meeting_id', sa.Uuid(), nullable=False),
    sa.Column('type', sa.String(length=30), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('metadata', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('source', sa.String(length=10), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['meeting_id'], ['meetings.id'], name=op.f('fk_meeting_insights_meeting_id_meetings'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_meeting_insights'))
    )
    with op.batch_alter_table('meeting_insights', schema=None) as batch_op:
        batch_op.create_index('ix_insights_meeting_type', ['meeting_id', 'type'], unique=False)

    op.create_table('meeting_participants',
    sa.Column('meeting_id', sa.Uuid(), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('email', sa.String(length=320), nullable=True),
    sa.Column('speaker_label', sa.String(length=40), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['meeting_id'], ['meetings.id'], name=op.f('fk_meeting_participants_meeting_id_meetings'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_meeting_participants'))
    )
    with op.batch_alter_table('meeting_participants', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_meeting_participants_meeting_id'), ['meeting_id'], unique=False)

    op.create_table('transcript_segments',
    sa.Column('meeting_id', sa.Uuid(), nullable=False),
    sa.Column('seq', sa.Integer(), nullable=False),
    sa.Column('speaker', sa.String(length=120), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('start_ms', sa.Integer(), nullable=False),
    sa.Column('end_ms', sa.Integer(), nullable=False),
    sa.Column('language', sa.String(length=10), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['meeting_id'], ['meetings.id'], name=op.f('fk_transcript_segments_meeting_id_meetings'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_transcript_segments'))
    )
    with op.batch_alter_table('transcript_segments', schema=None) as batch_op:
        batch_op.create_index('ix_segments_meeting_seq', ['meeting_id', 'seq'], unique=False)

    op.create_table('transcripts',
    sa.Column('meeting_id', sa.Uuid(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('timestamps', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('language', sa.String(length=10), nullable=False),
    sa.Column('provider', sa.String(length=40), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['meeting_id'], ['meetings.id'], name=op.f('fk_transcripts_meeting_id_meetings'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_transcripts')),
    sa.UniqueConstraint('meeting_id', name=op.f('uq_transcripts_meeting_id'))
    )
    with op.batch_alter_table('transcripts', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_transcripts_created_at'), ['created_at'], unique=False)

    op.create_table('brand_systems',
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('is_default', sa.Boolean(), nullable=False),
    sa.Column('brand_lock', sa.Boolean(), nullable=False),
    sa.Column('colors', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('fonts', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('logo_asset_id', sa.Uuid(), nullable=True),
    sa.Column('guidelines', sa.Text(), nullable=False),
    sa.Column('visual_rules', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('tone_of_voice', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('company_profile', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('approved_messaging', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('default_style', sa.String(length=30), nullable=False),
    sa.Column('default_template_id', sa.Uuid(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    *([sa.ForeignKeyConstraint(['default_template_id'], ['templates.id'], name=op.f('fk_brand_systems_default_template_id_templates'), ondelete='SET NULL')] if _sqlite() else []),
    sa.ForeignKeyConstraint(['logo_asset_id'], ['assets.id'], name=op.f('fk_brand_systems_logo_asset_id_assets'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_brand_systems_organization_id_organizations'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_brand_systems'))
    )
    with op.batch_alter_table('brand_systems', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_brand_systems_created_at'), ['created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_brand_systems_organization_id'), ['organization_id'], unique=False)

    op.create_table('presentations',
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.Column('title', sa.String(length=300), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('schema', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('created_by', sa.Uuid(), nullable=True),
    sa.Column('brand_system_id', sa.Uuid(), nullable=True),
    sa.Column('template_id', sa.Uuid(), nullable=True),
    sa.Column('folder_id', sa.Uuid(), nullable=True),
    sa.Column('source', sa.String(length=20), nullable=False),
    sa.Column('source_meeting_id', sa.Uuid(), nullable=True),
    sa.Column('prompt', sa.Text(), nullable=True),
    sa.Column('options', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('style', sa.String(length=30), nullable=False),
    sa.Column('last_presented_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['brand_system_id'], ['brand_systems.id'], name=op.f('fk_presentations_brand_system_id_brand_systems'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_presentations_created_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['folder_id'], ['folders.id'], name=op.f('fk_presentations_folder_id_folders'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_presentations_organization_id_organizations'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['source_meeting_id'], ['meetings.id'], name=op.f('fk_presentations_source_meeting_id_meetings'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['template_id'], ['templates.id'], name=op.f('fk_presentations_template_id_templates'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_presentations'))
    )
    with op.batch_alter_table('presentations', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_presentations_created_at'), ['created_at'], unique=False)
        batch_op.create_index('ix_presentations_org_updated', ['organization_id', 'updated_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_presentations_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_presentations_status'), ['status'], unique=False)

    op.create_table('proposals',
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.Column('client', sa.String(length=200), nullable=False),
    sa.Column('industry', sa.String(length=120), nullable=True),
    sa.Column('contact_name', sa.String(length=200), nullable=True),
    sa.Column('contact_email', sa.String(length=320), nullable=True),
    sa.Column('opportunity', sa.String(length=300), nullable=True),
    sa.Column('title', sa.String(length=300), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('value', sa.Numeric(precision=14, scale=2), nullable=True),
    sa.Column('currency', sa.String(length=3), nullable=False),
    sa.Column('deadline', sa.Date(), nullable=True),
    sa.Column('status', sa.String(length=30), nullable=False),
    sa.Column('schema', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('prompt', sa.Text(), nullable=True),
    sa.Column('brand_system_id', sa.Uuid(), nullable=True),
    sa.Column('created_by', sa.Uuid(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['brand_system_id'], ['brand_systems.id'], name=op.f('fk_proposals_brand_system_id_brand_systems'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_proposals_created_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_proposals_organization_id_organizations'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_proposals'))
    )
    with op.batch_alter_table('proposals', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_proposals_client'), ['client'], unique=False)
        batch_op.create_index(batch_op.f('ix_proposals_created_at'), ['created_at'], unique=False)
        batch_op.create_index('ix_proposals_org_status', ['organization_id', 'status'], unique=False)
        batch_op.create_index(batch_op.f('ix_proposals_organization_id'), ['organization_id'], unique=False)

    op.create_table('presentation_slides',
    sa.Column('presentation_id', sa.Uuid(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('schema', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['presentation_id'], ['presentations.id'], name=op.f('fk_presentation_slides_presentation_id_presentations'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_presentation_slides'))
    )
    with op.batch_alter_table('presentation_slides', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_presentation_slides_created_at'), ['created_at'], unique=False)
        batch_op.create_index('ix_slides_presentation_position', ['presentation_id', 'position'], unique=False)


    if not _sqlite():
        # Cyclic references are added once both tables exist.
        op.create_foreign_key(op.f('fk_meetings_presentation_id_presentations'), 'meetings', 'presentations', ['presentation_id'], ['id'], ondelete='SET NULL')
        op.create_foreign_key(op.f('fk_brand_systems_default_template_id_templates'), 'brand_systems', 'templates', ['default_template_id'], ['id'], ondelete='SET NULL')
    if _pgvector():
        # Approximate nearest-neighbour index for cosine similarity retrieval.
        op.execute("CREATE INDEX IF NOT EXISTS ix_document_chunks_embedding_hnsw ON document_chunks USING hnsw (embedding vector_cosine_ops)")
        op.create_index('ix_document_chunks_org', 'document_chunks', ['organization_id', 'document_id'])


def downgrade() -> None:
    if not _sqlite():
        op.drop_constraint(op.f('fk_meetings_presentation_id_presentations'), 'meetings', type_='foreignkey')
        op.drop_constraint(op.f('fk_brand_systems_default_template_id_templates'), 'brand_systems', type_='foreignkey')
    if _pgvector():
        op.drop_index('ix_document_chunks_org', table_name='document_chunks')
        op.execute("DROP INDEX IF EXISTS ix_document_chunks_embedding_hnsw")
    with op.batch_alter_table('presentation_slides', schema=None) as batch_op:
        batch_op.drop_index('ix_slides_presentation_position')
        batch_op.drop_index(batch_op.f('ix_presentation_slides_created_at'))

    op.drop_table('presentation_slides')
    with op.batch_alter_table('proposals', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_proposals_organization_id'))
        batch_op.drop_index('ix_proposals_org_status')
        batch_op.drop_index(batch_op.f('ix_proposals_created_at'))
        batch_op.drop_index(batch_op.f('ix_proposals_client'))

    op.drop_table('proposals')
    with op.batch_alter_table('presentations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_presentations_status'))
        batch_op.drop_index(batch_op.f('ix_presentations_organization_id'))
        batch_op.drop_index('ix_presentations_org_updated')
        batch_op.drop_index(batch_op.f('ix_presentations_created_at'))

    op.drop_table('presentations')
    with op.batch_alter_table('brand_systems', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_brand_systems_organization_id'))
        batch_op.drop_index(batch_op.f('ix_brand_systems_created_at'))

    op.drop_table('brand_systems')
    with op.batch_alter_table('transcripts', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_transcripts_created_at'))

    op.drop_table('transcripts')
    with op.batch_alter_table('transcript_segments', schema=None) as batch_op:
        batch_op.drop_index('ix_segments_meeting_seq')

    op.drop_table('transcript_segments')
    with op.batch_alter_table('meeting_participants', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_meeting_participants_meeting_id'))

    op.drop_table('meeting_participants')
    with op.batch_alter_table('meeting_insights', schema=None) as batch_op:
        batch_op.drop_index('ix_insights_meeting_type')

    op.drop_table('meeting_insights')
    with op.batch_alter_table('document_chunks', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_document_chunks_organization_id'))
        batch_op.drop_index('ix_chunks_document_index')

    op.drop_table('document_chunks')
    with op.batch_alter_table('assets', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_assets_organization_id'))
        batch_op.drop_index('ix_assets_org_type')
        batch_op.drop_index(batch_op.f('ix_assets_created_at'))

    op.drop_table('assets')
    with op.batch_alter_table('action_items', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_action_items_organization_id'))
        batch_op.drop_index(batch_op.f('ix_action_items_meeting_id'))

    op.drop_table('action_items')
    with op.batch_alter_table('templates', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_templates_organization_id'))
        batch_op.drop_index('ix_templates_org_category')
        batch_op.drop_index(batch_op.f('ix_templates_created_at'))

    op.drop_table('templates')
    with op.batch_alter_table('share_links', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_share_links_token'))
        batch_op.drop_index('ix_share_links_resource')
        batch_op.drop_index(batch_op.f('ix_share_links_organization_id'))

    op.drop_table('share_links')
    with op.batch_alter_table('memberships', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_memberships_user_id'))
        batch_op.drop_index(batch_op.f('ix_memberships_organization_id'))

    op.drop_table('memberships')
    with op.batch_alter_table('meetings', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_meetings_status'))
        batch_op.drop_index(batch_op.f('ix_meetings_organization_id'))
        batch_op.drop_index('ix_meetings_org_started')
        batch_op.drop_index(batch_op.f('ix_meetings_created_at'))

    op.drop_table('meetings')
    with op.batch_alter_table('jobs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_jobs_organization_id'))
        batch_op.drop_index('ix_jobs_org_status')

    op.drop_table('jobs')
    with op.batch_alter_table('invitations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_invitations_organization_id'))
        batch_op.drop_index(batch_op.f('ix_invitations_email'))

    op.drop_table('invitations')
    with op.batch_alter_table('folders', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_folders_organization_id'))

    op.drop_table('folders')
    with op.batch_alter_table('favorites', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_favorites_user_id'))
        batch_op.drop_index(batch_op.f('ix_favorites_resource_id'))
        batch_op.drop_index(batch_op.f('ix_favorites_organization_id'))

    op.drop_table('favorites')
    with op.batch_alter_table('documents', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_documents_organization_id'))
        batch_op.drop_index('ix_documents_org_category')
        batch_op.drop_index(batch_op.f('ix_documents_created_at'))

    op.drop_table('documents')
    with op.batch_alter_table('auth_sessions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_auth_sessions_user_id'))

    op.drop_table('auth_sessions')
    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.drop_index('ix_audit_org_created')

    op.drop_table('audit_logs')
    with op.batch_alter_table('api_keys', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_api_keys_organization_id'))

    op.drop_table('api_keys')
    with op.batch_alter_table('ai_generations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_ai_generations_task'))
        batch_op.drop_index('ix_ai_generations_org_created')

    op.drop_table('ai_generations')
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_users_email'))

    op.drop_table('users')
    with op.batch_alter_table('organizations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_organizations_slug'))

    op.drop_table('organizations')
