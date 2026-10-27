# cbam.extract_energy_invoice

| Field | Value |
|---|---|
| promptId | `cbam.extract_energy_invoice` |
| businessType | `CBAM_ENERGY_INVOICE_EXTRACT` |
| version | `extract-gas@1.0.0` |
| stages | `data-prep` |
| completionMode | `proposal_only` |

## Purpose

Extract period, facility, and natural-gas quantity from an energy invoice. Output is a **proposal** only.

## Must not

- Confirm enterprise facts
- Confirm service bindings
- Create calculation runs

## Expected proposal shape

- `targetAssetType`: `energyConsumption`
- `proposedPatch.originalValue` / `originalUnit`
- optional `binding` with status implied `PROPOSED`
