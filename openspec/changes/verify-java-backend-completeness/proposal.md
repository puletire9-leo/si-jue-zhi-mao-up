## Why

The project has undergone a full backend migration from Python FastAPI (27 route files) to Java Spring Boot (27 controllers). The previous session fixed numerous entity/schema mismatches, API route mismatches, and compilation issues. A systematic audit is needed to confirm every Python API endpoint has a working Java equivalent, every database table is correctly mapped, and the frontend functions end-to-end on the Java backend.

## What Changes

- **Audit every API endpoint**: Cross-reference all 27 Python route files against the 27 Java controllers to confirm 100% coverage
- **Verify DB entity mappings**: Confirm all Java entities (@TableName, @TableField, @TableId) match the actual `sijuelishi_dev` database schema
- **End-to-end flow testing**: Verify login → CRUD → file upload → image proxy → COS storage works as a complete chain
- **Frontend integration check**: Confirm the Vite dev server (port 5173) correctly proxies to Java (port 8090) and all pages render without API errors
- **Identify and fix any remaining gaps**: Document any missing endpoints, entity mismatches, or broken flows found during audit

## Capabilities

### New Capabilities
- `api-endpoint-audit`: Systematic comparison of Python route files vs Java controllers to ensure every business API endpoint has been migrated
- `entity-schema-verification`: Verification that all Java entity annotations correctly map to the actual database column names and types
- `end-to-end-flow-test`: Complete business flow testing (auth + CRUD + file operations + COS) to confirm system works as a whole
- `frontend-integration-verification`: Confirm frontend pages render without API errors when connected to Java backend

### Modified Capabilities
<!-- None — this is a verification/migration-completion check, not a feature change -->

## Impact

- Affected code: All 27 Java controllers, 14 entity classes, frontend API modules (`frontend/src/api/`), Vite config
- Database: `sijuelishi_dev` — read/write operations during flow tests
- External: Tencent COS (`sijuelishi-dev-1328246743`, ap-guangzhou) — verify connectivity
- No breaking changes — verification-only task
