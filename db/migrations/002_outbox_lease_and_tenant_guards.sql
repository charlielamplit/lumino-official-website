-- 002_outbox_lease_and_tenant_guards.sql
-- Outbox lease/dead-letter, tenant-consistent FKs, audit immutability.

ALTER TABLE outbox_events
  DROP CONSTRAINT IF EXISTS outbox_events_status_check;

ALTER TABLE outbox_events
  ADD CONSTRAINT outbox_events_status_check
  CHECK (status IN ('pending','processing','sent','failed','dead'));

ALTER TABLE outbox_events
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_leads_id_tenant ON leads(id, tenant_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lead_events_lead_tenant_fk'
  ) THEN
    ALTER TABLE lead_events
      ADD CONSTRAINT lead_events_lead_tenant_fk
      FOREIGN KEY (lead_id, tenant_id) REFERENCES leads(id, tenant_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'outbox_events_lead_tenant_fk'
  ) THEN
    ALTER TABLE outbox_events
      ADD CONSTRAINT outbox_events_lead_tenant_fk
      FOREIGN KEY (lead_id, tenant_id) REFERENCES leads(id, tenant_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events;
CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE PROCEDURE prevent_audit_mutation();
