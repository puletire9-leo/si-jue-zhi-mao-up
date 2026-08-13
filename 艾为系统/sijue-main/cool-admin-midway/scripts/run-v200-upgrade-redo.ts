/**
 * v2.0.0 数据结构升级：手动 redo，依次对 4 个 migration 先 down 再 up。
 *
 * 本地（仓库根或 cool-admin-midway 目录）：
 *   cd cool-admin-midway && npx ts-node -r tsconfig-paths/register src/scripts/run-v200-upgrade-redo.ts
 *
 * 线上容器内（已拉取最新镜像并 up 后）：
 *   docker compose exec midway node dist/scripts/run-v200-upgrade-redo.js
 * 或先进入容器再执行：
 *   docker compose exec midway sh
 *   node dist/scripts/run-v200-upgrade-redo.js
 */
import { DataSource } from 'typeorm';
import { join } from 'path';

const isProd = process.env.NODE_ENV === 'production';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require(isProd ? '../config/config.prod' : '../config/config.local').default;
import { FactoryVariantTables1738540000000 } from '../migration/1738500000000-factory-variant-tables';
import { BizLogicChange1738500000000 } from '../migration/1738510000000-purchase-table-change';
import { MskuTable1738510000000 } from '../migration/1738520000000-msku-table';
import { DesignTask1738520000000 } from '../migration/1738530000000-design-task';

const ds = (config as any).typeorm.dataSource.default;
const migrationDir = join(__dirname, '../migration');
const migrationExt = __dirname.includes('dist') ? '.js' : '.ts';

const dataSource = new DataSource({
  type: ds.type,
  host: ds.host,
  port: ds.port,
  username: ds.username,
  password: ds.password,
  database: ds.database,
  charset: ds.charset,
  migrations: [
    join(migrationDir, `1738500000000-factory-variant-tables${migrationExt}`),
    join(migrationDir, `1738510000000-purchase-table-change${migrationExt}`),
    join(migrationDir, `1738520000000-msku-table${migrationExt}`),
    join(migrationDir, `1738530000000-design-task${migrationExt}`),
  ],
});

const MIGRATIONS: Array<{ name: string; instance: { down: (qr: any) => Promise<void> } }> = [
  { name: 'FactoryVariantTables1738540000000', instance: new FactoryVariantTables1738540000000() },
  { name: 'BizLogicChange1738500000000', instance: new BizLogicChange1738500000000() },
  { name: 'MskuTable1738510000000', instance: new MskuTable1738510000000() },
  { name: 'DesignTask1738520000000', instance: new DesignTask1738520000000() },
];

async function main() {
  await dataSource.initialize();
  const qr = dataSource.createQueryRunner();
  await qr.connect();

  try {
    for (const { name, instance } of MIGRATIONS) {
      console.log(`--- ${name}: down...`);
      await instance.down(qr);
      await dataSource.query('DELETE FROM migrations WHERE name = ?', [name]);
      console.log(`--- ${name}: down done, running up via runMigrations...`);
      await dataSource.runMigrations();
      console.log(`--- ${name} redo done.`);
    }
  } finally {
    await qr.release();
  }

  await dataSource.destroy();
  console.log('v2.0.0 upgrade redos done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
