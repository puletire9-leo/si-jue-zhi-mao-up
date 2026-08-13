-- Merge active sjzm accounts into ai_platform.users without changing existing rows.
-- Prerequisite: load the Docker users table into ai_platform._sjzm_users_import.
-- Existing username/password/role/status values always win.

SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO users (
    id, name, password, role, createdAt, username, email, full_name,
    developer, status, updated_at, last_login_time
)
SELECT
    UUID(),
    COALESCE(NULLIF(source_user.full_name, ''), source_user.username),
    '123456',
    CASE
        WHEN source_user.role LIKE '%admin%' OR source_user.role LIKE '%管理员%' THEN 'MANAGER'
        WHEN source_user.role LIKE '%开发%' OR source_user.role LIKE '%developer%' THEN 'DEVELOPER'
        WHEN source_user.role LIKE '%美术%' OR source_user.role LIKE '%artist%' THEN 'ART_MANAGER'
        ELSE 'OPERATOR'
    END,
    DATE_FORMAT(COALESCE(source_user.created_at, NOW()), '%Y-%m-%dT%H:%i:%sZ'),
    source_user.username,
    source_user.email,
    source_user.full_name,
    source_user.developer,
    source_user.status,
    source_user.updated_at,
    source_user.last_login_time
FROM _sjzm_users_import source_user
WHERE source_user.status = 1
  AND NOT EXISTS (
      SELECT 1
      FROM users target_user
      WHERE target_user.username COLLATE utf8mb4_unicode_ci =
            source_user.username COLLATE utf8mb4_unicode_ci
  );

COMMIT;

DROP TABLE _sjzm_users_import;
