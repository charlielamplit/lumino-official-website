# pcf.suggest_boundary

| Field | Value |
|---|---|
| promptId | `pcf.suggest_boundary` |
| businessType | `PCF_BOUNDARY_SUGGEST` |
| version | `pcf-boundary@0.2.0` |
| stages | `boundary` |
| completionMode | `proposal_only` |

## Purpose

Suggest system boundary type, included processes, excluded items, and cut-off rules.
Human confirmation is mandatory before the boundary becomes a formal study input.

## Must not

- Confirm system boundary
- Confirm functional unit
- Write formal workflow status as CONFIRMED

## Expected proposal shape

- `boundaryType`
- `includedProcesses[]`
- `excludedItems[]`
- `cutOffRule` / `cutOffRationale`
- `primaryInputs[]`
- `status`: `PROPOSED`
