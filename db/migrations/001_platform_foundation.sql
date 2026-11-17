-- 001_platform_foundation.sql
-- Phase-1 minimum platform tables for Lumino leads + authority.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  checksum text
);

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1)
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1)
);

CREATE TABLE IF NOT EXISTS tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  roles text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  UNIQUE (tenant_id, user_id),
  CONSTRAINT tenant_memberships_roles_nonempty CHECK (cardinality(roles) > 0)
);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user ON tenant_memberships(user_id) WHERE is_active AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant ON tenant_memberships(tenant_id) WHERE is_active AND archived_at IS NULL;

CREATE TABLE IF NOT EXISTS staff_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  last_seen_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_user ON staff_sessions(user_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  status text NOT NULL CHECK (status IN ('new','claimed','qualified','disqualified','converted')),
  company text NOT NULL CHECK (char_length(company) BETWEEN 1 AND 120),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  phone text,
  email text,
  email_normalized citext,
  phone_normalized text,
  industry text,
  timeline text,
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text NOT NULL,
  notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL,
  request_type text NOT NULL DEFAULT 'service-consultation',
  consent boolean NOT NULL,
  consent_at timestamptz NOT NULL,
  notice_version text NOT NULL DEFAULT 'v1',
  context jsonb,
  user_agent text,
  claimed_by_user_id uuid REFERENCES users(id),
  claimed_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  archived_at timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  CONSTRAINT leads_services_array CHECK (jsonb_typeof(services) = 'array'),
  CONSTRAINT leads_contact_present CHECK (coalesce(nullif(phone, ''), nullif(email, '')) IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant_created ON leads(tenant_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_tenant_status ON leads(tenant_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_email_norm ON leads(tenant_id, email_normalized) WHERE deleted_at IS NULL AND email_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_phone_norm ON leads(tenant_id, phone_normalized) WHERE deleted_at IS NULL AND phone_normalized IS NOT NULL;

CREATE TABLE IF NOT EXISTS lead_daily_counters (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  day date NOT NULL,
  seq integer NOT NULL DEFAULT 0 CHECK (seq >= 0),
  PRIMARY KEY (tenant_id, day)
);

CREATE TABLE IF NOT EXISTS lead_events (
  id bigserial PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES leads(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  event_type text NOT NULL,
  actor_user_id uuid REFERENCES users(id),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON lead_events(tenant_id, lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS outbox_events (
  id bigserial PRIMARY KEY,
  event_key text NOT NULL UNIQUE,
  lead_id uuid NOT NULL REFERENCES leads(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  channel text NOT NULL CHECK (channel IN ('wecom','webhook','email')),
  status text NOT NULL CHECK (status IN ('pending','processing','sent','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_code text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events(status, next_attempt_at) WHERE status IN ('pending','processing','failed');

CREATE TABLE IF NOT EXISTS audit_events (
  id bigserial PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  actor_user_id uuid REFERENCES users(id),
  actor_email_snapshot text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_created ON audit_events(tenant_id, created_at DESC);
