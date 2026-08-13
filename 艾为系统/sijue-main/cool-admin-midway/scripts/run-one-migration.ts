/**
 * 手动执行指定的单条 migration（按文件名）。
 *
 * 用法（在 cool-admin-midway 目录下）：
 *   npx ts-node -r tsconfig-paths/register scripts/run-one-migration.ts <migration文件名>
 *
 * 示例：
 *   npx ts-node -r tsconfig-paths/register scripts/run-one-migration.ts 1738540000000-seller-account-refactor.ts
 *   npx ts-node -r tsconfig-paths/register scripts/run-one-migration.ts 1738530000000-design-task
 *
 * 数据库配置：优先 src/config/config.local.ts；若不存在（如 Docker 镜像未包含）则用 config.prod（环境变量 MYSQL_*）。
 */
import { DataSource } from 'typeorm';
import { join } from 'path';
import { existsSync } from 'fs';

function getFilename(): string {
  const filename = process.argv[2];
  if (!filename) {
    console.error('用法: npx ts-node -r tsconfig-paths/register scripts/run-one-migration.ts <migration文件名>');
    console.error('示例: npx ts-node -r tsconfig-paths/register scripts/run-one-migration.ts 1738540000000-seller-account-refactor.ts');
    process.exit(1);
  }
  return filename.endsWith('.ts') ? filename : filename + '.ts';
}

async function main() {
  const filename = getFilename();
  const migrationPath = join(__dirname, '../src/migration', filename);

  if (!existsSync(migrationPath)) {
    console.error(`migration 文件不存在: ${migrationPath}`);
    process.exit(1);
  }

  let config: any;
  try {
    config = require('../src/config/config.local').default;
  } catch {
    try {
      config = require('../src/config/config.prod').default;
    } catch {
      try {
        config = require('../dist/config/config.prod').default;
      } catch (e) {
        console.error('未找到 config.local / config.prod（src 或 dist）:', (e as NodeJS.ErrnoException).code);
        process.exit(1);
      }
    }
  }
  const ds = config?.typeorm?.dataSource?.default;
  if (!ds) {
    console.error('配置中未找到 typeorm.dataSource.default');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: ds.type,
    host: ds.host,
    port: ds.port,
    username: ds.username,
    password: ds.password,
    database: ds.database,
    charset: ds.charset ?? 'utf8mb4',
    migrations: [migrationPath],
  });

  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();
  console.log(`migration 执行完成: ${filename}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
