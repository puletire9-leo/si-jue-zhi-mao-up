/**
 * 先降级再升级 1738510000000-msku-table，彻底重建 app_amz_msku 表及采购表 msku 列。
 * 在 cool-admin-midway 目录执行：
 *   npx ts-node -r tsconfig-paths/register scripts/run-msku-table-redo.ts
 */
import { DataSource } from 'typeorm';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('../src/config/config.local').default;
import { MskuTable1738510000000 } from '../src/migration/1738510000000-msku-table';

const ds = (config as any).typeorm.dataSource.default;
const dataSource = new DataSource({
  type: ds.type,
  host: ds.host,
  port: ds.port,
  username: ds.username,
  password: ds.password,
  database: ds.database,
  charset: ds.charset,
  migrations: [join(__dirname, '../src/migration/1738510000000-msku-table.ts')],
});

const MIGRATION_NAME = 'MskuTable1738510000000';

async function main() {
  await dataSource.initialize();

  const migration = new MskuTable1738510000000();
  const qr = dataSource.createQueryRunner();
  await qr.connect();
  try {
    console.log('Running down...');
    await migration.down(qr);
    await dataSource.query('DELETE FROM migrations WHERE name = ?', [MIGRATION_NAME]);
    console.log('Down done. Running up...');
  } finally {
    await qr.release();
  }

  await dataSource.runMigrations();
  await dataSource.destroy();
  console.log('1738510000000-msku-table redo done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
