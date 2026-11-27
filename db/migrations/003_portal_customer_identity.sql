-- Customer sessions and the first server-owned CBAM annual project.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS portal_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  last_seen_at timestamptz,
  FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_memberships(tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_user ON portal_sessions(user_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS portal_annual_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  service_year integer NOT NULL CHECK (service_year BETWEEN 2026 AND 2100),
  status text NOT NULL DEFAULT 'SETUP_DRAFT' CHECK (status IN ('SETUP_DRAFT','ACTIVE','ARCHIVED')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  UNIQUE (tenant_id, service_year)
);

CREATE TABLE IF NOT EXISTS portal_login_attempts (
  email_hash text PRIMARY KEY,
  failures integer NOT NULL DEFAULT 0 CHECK (failures >= 0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);
