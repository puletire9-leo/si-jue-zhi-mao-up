## Context

The project was originally a Python FastAPI backend with 27 route files and 253 endpoints. Over the past sessions, all business logic modules were migrated to Java Spring Boot controllers with MyBatis-Plus ORM. The migration followed a module-by-module approach, and entity mappings were adjusted to match the `sijuelishi_dev` database schema. The last session fixed 6 remaining bugs (Category ORDER BY, DownloadTask ID type, URL path mismatches, SystemLog SQL columns, image URL generation, and Maven/JDK compatibility). All 19 core API endpoints now return 200.

The frontend (Vue 3 + Vite) proxies `/api/*` requests to Java on port 8090. COS (Tencent Cloud Object Storage) connectivity is confirmed. The system appears complete but needs a structured verification pass.

## Goals / Non-Goals

**Goals:**
- Confirm all 253 Python endpoints have working Java equivalents
- Verify every database table used by the application has correct entity mappings
- Run end-to-end business flows: auth → CRUD → file upload → image proxy → COS
- Confirm frontend pages render without API errors
- Document any remaining gaps or issues found

**Non-Goals:**
- Performance optimization or load testing
- Refactoring or code style changes
- Adding new features beyond what Python backend provided
- Production deployment configuration

## Decisions

### Audit approach: Python route inventory vs Java controller inventory

Compare all 27 Python route files under `backend/app/api/` against the 27 Java controllers under `com.sjzm.controller/`. Map each Python route decorator (`@router.get/post/put/delete`) to the corresponding Spring `@GetMapping/@PostMapping/@PutMapping/@DeleteMapping`.

**Why not automated API diffing**: The Python backend is not currently running. Manual code comparison handles route parameter naming differences more accurately than schema diff tools.

### Entity verification: DB schema vs @TableField annotations

Query `DESCRIBE <table>` for all 14 tables, then compare against each entity's `@TableField` annotations and field types. The prior session already fixed `exist=false` mismatches and ID type issues — this pass confirms completeness.

### Flow testing: Login-required chain

All tests will use a valid admin token (`admin/123456`) obtained via `/api/v1/auth/login`. Flow tests cover:
1. Upload image → verify file saved locally → verify DB record with correct URL
2. Create product → verify product appears in list
3. Final draft CRUD → recycle bin → restore
4. Material/Carrier library with batch operations

### Frontend check: Browser-based verification

Rather than automated E2E, manually navigate each major page category (ProductData, FinalDraft, MaterialLibrary, CarrierLibrary, Selection, Images) and check browser DevTools for red API errors.

## Risks / Trade-offs

- [Risk] Some endpoints depend on Parquet data files at `/data/parquet/` (Linux path) which don't exist on Windows dev → **Mitigation**: ProductSales and ProductData endpoints are expected to 500 in dev; verified they exist as controllers with correct code structure
- [Risk] Python AI service is not running on Windows → **Mitigation**: VectorSearchService and PythonAIServiceClient have fallback mock modes, confirmed in logs
- [Risk] Image proxy COS endpoint returns 500 for nonexistent files → **Mitigation**: This is expected behavior; test with known-good COS paths only

## Open Questions

1. Are there Python endpoints that handle functionality NOT covered by any Java controller?
2. Does the frontend call any API paths that don't exist in Java? (The `/api/v1/logs/frontend` error from previous session suggests possible gaps)
3. Are all 14 database tables properly mapped in entities, or are there remaining `exist=false` fields that should be real columns?
