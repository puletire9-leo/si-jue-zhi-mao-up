/**
 * 只执行 1738500000000-purchase-table-change 这一条 migration。
 * 在 cool-admin-midway 目录执行：
 *   npx ts-node -r tsconfig-paths/register scripts/run-purchase-table-migration.ts
 */
import { DataSource } from 'typeorm';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('../src/config/config.local').default;

const ds = (config as any).typeorm.dataSource.default;
const dataSource = new DataSource({
  type: ds.type,
  host: ds.host,
  port: ds.port,
  username: ds.username,
  password: ds.password,
  database: ds.database,
  charset: ds.charset,
  migrations: [join(__dirname, '../src/migration/1738500000000-purchase-table-change.ts')],
});

async function main() {
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();
  console.log('1738500000000-purchase-table-change done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
