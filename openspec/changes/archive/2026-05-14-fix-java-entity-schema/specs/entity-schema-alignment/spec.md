## ADDED Requirements

### Requirement: Table Name Alignment
Each Java Entity's `@TableName` SHALL match the corresponding MySQL table name exactly (case-sensitive).

#### Scenario: Product entity maps to products table
- **WHEN** `ProductMapper.selectList()` is called
- **THEN** the SQL targets the `products` table, not `product`

#### Scenario: User entity maps to users table
- **WHEN** `UserMapper.selectById()` is called
- **THEN** the SQL targets the `users` table, not `user`

### Requirement: Column Name Alignment
Each Java field SHALL be mapped to the correct MySQL column name via `@TableField` or MyBatis-Plus naming strategy.

#### Scenario: SKU-based primary key
- **WHEN** `ProductMapper.selectById("SKU-001")` is called
- **THEN** the query uses the `sku` column as the primary key, not `id`

#### Scenario: Varchar timestamp column
- **WHEN** a Product entity is read from the database
- **THEN** the `create_time` field maps to the database column `create_time` (varchar) and is read as String

### Requirement: Primary Key Strategy Alignment
Entities with non-auto-increment primary keys SHALL use the correct `@TableId` type matching the database schema.

#### Scenario: SKU as primary key
- **WHEN** a new Product is inserted
- **THEN** the primary key is the manually assigned `sku` value, not an auto-generated ID

### Requirement: API Endpoint Validation
After entity alignment, core API endpoints SHALL return valid JSON responses instead of SQL errors.

#### Scenario: Product list returns data
- **WHEN** `GET /api/v1/products?page=1&pageSize=3` is called
- **THEN** the response contains `code: 200` and a list of products

#### Scenario: Login returns token
- **WHEN** `POST /api/v1/auth/login` with valid credentials
- **THEN** the response contains `access_token` and `refresh_token`
