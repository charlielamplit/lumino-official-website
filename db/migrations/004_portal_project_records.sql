-- Tenant-owned intake records for the first CBAM annual project workflow.
CREATE TABLE IF NOT EXISTS portal_project_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  project_id uuid NOT NULL REFERENCES portal_annual_projects(id),
  kind text NOT NULL CHECK (kind IN ('product', 'facility', 'material_request')),
  payload jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, created_by) REFERENCES tenant_memberships(tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_portal_project_records_scope ON portal_project_records(tenant_id, project_id, created_at);
