## 1. API Endpoint Audit

- [x] 1.1 Inventory all 27 Python route files and 253 endpoints in `backend/app/api/`
- [x] 1.2 Inventory all 27 Java controllers and mapped paths in `com.sjzm.controller/`
- [x] 1.3 Cross-reference and list any Python endpoints without Java equivalents
- [x] 1.4 Verify frontend `src/api/` module paths all resolve to Java controller paths
- [x] 1.5 Test each Java controller with one GET request, record failures

## 2. Entity Schema Verification

- [x] 2.1 Query `DESCRIBE` for all 14+ tables in `sijuelishi_dev`
- [x] 2.2 Check each entity's `@TableName`, `@TableId`, `@TableField(exist = false)` against actual schema
- [x] 2.3 Verify no `exist = false` fields should actually map to real columns
- [x] 2.4 Verify all ID types (AUTO vs INPUT vs ASSIGN_ID) match DB column types
- [x] 2.5 Confirm cache annotations do not cause SQL errors on cached services

## 3. End-to-End Flow Testing

- [x] 3.1 Test auth flow: register → login → get current user → refresh token → logout
- [x] 3.2 Test image flow: upload → list → get file → get thumbnail → delete
- [x] 3.3 Test product CRUD: create → read → update → delete → restore from recycle
- [x] 3.4 Test final-draft flow with batch operations and recycle bin
- [x] 3.5 Test material-library flow with batch import and element tags
- [x] 3.6 Test carrier-library flow with batch operations
- [x] 3.7 Test selection flow: list (new/reference/all) → import → stats → export
- [x] 3.8 Verify COS connectivity and image proxy responds correctly
- [x] 3.9 Test export/download task creation and status tracking

## 4. Frontend Integration Verification

- [x] 4.1 Confirm Vite proxy is forwarding /api/* to Java :8090 (no ECONNREFUSED)
- [x] 4.2 Navigate ProductDataDashboard page, check for API errors
- [x] 4.3 Navigate FinalDraft page, verify images and thumbnails load
- [x] 4.4 Navigate MaterialLibrary page, verify data loads
- [x] 4.5 Navigate CarrierLibrary page, verify data loads
- [x] 4.6 Navigate Image Management page, verify thumbnails via COS proxy
- [x] 4.7 Navigate Login page, verify auth flow
- [x] 4.8 Document any remaining frontend API errors found
