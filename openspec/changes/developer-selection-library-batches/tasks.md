## 1. Database and backend model

- [x] 1.1 Add the developer batch table and nullable library batch reference to all schema and idempotent migration files
- [x] 1.2 Add batch entity, mapper, request DTOs, and batch fields to library item/query models
- [x] 1.3 Implement batch listing, creation, assignment, unassignment, authorization, and conversion-clears-batch service behavior
- [x] 1.4 Expose batch APIs and include batch names in list/export records
- [x] 1.5 Resolve the active 刘淼 account as the administrator default owner for item additions and batch creation

## 2. Frontend workflow

- [x] 2.1 Extend the artificial-library API client with batch types and operations
- [x] 2.2 Add independent batch tabs, date-default creation, developer-aware filtering, and classification labels
- [x] 2.3 Reuse selection mode for card click selection, current-page select-all, batch assignment, and unassignment
- [x] 2.4 Reuse and persist the unified card-size control in the artificial library
- [x] 2.5 Default administrator library filtering and add-to-library actions to 刘淼

## 3. Documentation and verification

- [x] 3.1 Synchronize frontend, Java, and database documentation
- [x] 3.2 Verify migration idempotency, Java compilation/tests, and frontend type/build checks
- [x] 3.3 Deploy through the production preflight flow and smoke-test batch permissions, filtering, conversion, and CSV fields
- [x] 3.4 Build, deploy, and verify administrator default ownership with production-safe smoke data
