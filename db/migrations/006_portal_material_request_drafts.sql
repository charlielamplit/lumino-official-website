-- A draft material plan belongs to one tenant, project, facility and quarter.
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_material_request_draft_unique
  ON portal_project_records (tenant_id, project_id, (payload->>'facilityId'), (payload->>'period'), (payload->>'dataItemCode'))
  WHERE kind = 'material_request' AND payload ? 'facilityId';
