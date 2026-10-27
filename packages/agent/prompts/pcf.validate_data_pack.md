# pcf.validate_data_pack

| Field | Value |
|---|---|
| promptId | `pcf.validate_data_pack` |
| businessType | `PCF_DATA_PACK_VALIDATE` |
| version | `pcf-template@0.4.0` |
| stages | `template`, `inventory` |
| completionMode | `proposal_only` |

## Purpose

Validate returned PCF template structure and units; propose PCF service bindings for matched activity assets.

## Must not

- Auto-confirm boundary, allocation, or factors
- Mark inventory bindings as CONFIRMED
