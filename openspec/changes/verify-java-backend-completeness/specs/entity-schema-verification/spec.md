## ADDED Requirements

### Requirement: Every database table has correct entity mapping
The system SHALL have Java entity classes whose `@TableName`, `@TableId`, and `@TableField` annotations accurately reflect the actual database schema.

#### Scenario: Table name matches
- **WHEN** a MyBatis-Plus query targets any Java entity
- **THEN** the `@TableName` annotation SHALL match the exact table name in `sijuelishi_dev`

#### Scenario: Primary key type matches
- **WHEN** a database table uses `int` auto-increment for its primary key
- **THEN** the Java entity SHALL use `@TableId(type = IdType.AUTO) private Long id`

#### Scenario: Columns exist in database
- **WHEN** a Java entity field is not marked `@TableField(exist = false)`
- **THEN** the corresponding column SHALL exist in the database with a compatible type

#### Scenario: Non-existent columns are excluded
- **WHEN** a Java entity has a field that does not exist in the database
- **THEN** it SHALL be annotated with `@TableField(exist = false)` to prevent SQL errors

### Requirement: Cache configuration does not break queries
Caffeine cache annotations (`@Cacheable`, `@CacheConfig`) SHALL not interfere with MyBatis-Plus query execution.

#### Scenario: Cached queries return valid results
- **WHEN** a cached service method is called
- **THEN** the query SHALL execute successfully and return expected data
