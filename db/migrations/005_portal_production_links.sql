-- Link tenant-owned products to the facilities that actually produce them.
ALTER TABLE portal_project_records DROP CONSTRAINT IF EXISTS portal_project_records_kind_check;
ALTER TABLE portal_project_records ADD CONSTRAINT portal_project_records_kind_check
  CHECK (kind IN ('product', 'facility', 'material_request', 'production_link'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_production_link_unique
  ON portal_project_records (tenant_id, project_id, (payload->>'productId'), (payload->>'facilityId'))
  WHERE kind = 'production_link';
