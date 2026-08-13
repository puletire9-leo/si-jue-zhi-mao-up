import { Provide } from '@midwayjs/decorator';
import { MigrationInterface, QueryRunner } from 'typeorm';

@Provide()
export class BsrCandidateReserve1780546000000 implements MigrationInterface {
  name = 'BsrCandidateReserve1780546000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ db: dbName }] = (await queryRunner.query(
      'SELECT DATABASE() as db'
    )) as Array<{ db: string }>;
    const [candidateTable] = (await queryRunner.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'app_amz_bsr_candidate'`,
      [dbName]
    )) as Array<{ TABLE_NAME: string }>;
    if (!candidateTable) return;

    const columns = (await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'app_amz_bsr_candidate'`,
      [dbName]
    )) as Array<{ COLUMN_NAME: string }>;
    const existing = new Set(columns.map(item => item.COLUMN_NAME));
    const addColumn = async (name: string, sql: string) => {
      if (!existing.has(name)) await queryRunner.query(sql);
    };

    await addColumn(
      'reserved_at',
      `ALTER TABLE \`app_amz_bsr_candidate\` ADD \`reserved_at\` datetime NULL COMMENT '进入预留时间'`
    );
    await addColumn(
      'reserved_by_user_id',
      `ALTER TABLE \`app_amz_bsr_candidate\` ADD \`reserved_by_user_id\` int NULL COMMENT '点击精选进入预留的用户ID'`
    );
    await addColumn(
      'reserved_by_user_name',
      `ALTER TABLE \`app_amz_bsr_candidate\` ADD \`reserved_by_user_name\` varchar(100) NULL COMMENT '点击精选进入预留的用户名称'`
    );
    await addColumn(
      'reserve_rejected_at',
      `ALTER TABLE \`app_amz_bsr_candidate\` ADD \`reserve_rejected_at\` datetime NULL COMMENT '预留打回时间'`
    );
    await addColumn(
      'reserve_rejected_by_user_id',
      `ALTER TABLE \`app_amz_bsr_candidate\` ADD \`reserve_rejected_by_user_id\` int NULL COMMENT '预留打回运营用户ID'`
    );
    await addColumn(
      'reserve_rejected_by_user_name',
      `ALTER TABLE \`app_amz_bsr_candidate\` ADD \`reserve_rejected_by_user_name\` varchar(100) NULL COMMENT '预留打回运营用户名称'`
    );
    await addColumn(
      'reserve_reject_reason',
      `ALTER TABLE \`app_amz_bsr_candidate\` ADD \`reserve_reject_reason\` text NULL COMMENT '预留打回原因'`
    );

    const requiredMenuTables = ['base_sys_menu', 'base_sys_role_menu'];
    const menuTables = (await queryRunner.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?, ?)`,
      [dbName, ...requiredMenuTables]
    )) as Array<{ TABLE_NAME: string }>;
    if (menuTables.length < requiredMenuTables.length) return;

    await queryRunner.query(`
      INSERT INTO \`base_sys_menu\` (\`parentId\`, \`name\`, \`router\`, \`perms\`, \`type\`, \`icon\`, \`orderNum\`, \`viewPath\`, \`keepAlive\`, \`isShow\`)
      SELECT source.parentId, 'BSR 选品预留', '/app/bsr-candidate-reserve', NULL, 1, source.icon, source.orderNum + 1,
             'modules/app/views/bsr-candidate-reserve.vue', source.keepAlive, true
      FROM \`base_sys_menu\` source
      WHERE (
          source.router IN ('/app/bsr-candidate4', 'app/bsr-candidate4', '/app/candidate4', 'app/candidate4')
          OR source.viewPath LIKE '%bsr-candidate4.vue%'
        )
        AND NOT EXISTS (
          SELECT 1 FROM \`base_sys_menu\` existing
          WHERE existing.router IN ('/app/bsr-candidate-reserve', 'app/bsr-candidate-reserve')
             OR existing.viewPath LIKE '%bsr-candidate-reserve.vue%'
        )
      LIMIT 1
    `);

    await queryRunner.query(`
      INSERT INTO \`base_sys_role_menu\` (\`roleId\`, \`menuId\`)
      SELECT rm.roleId, reserve.id
      FROM \`base_sys_role_menu\` rm
      JOIN \`base_sys_menu\` candidate4 ON candidate4.id = rm.menuId
      JOIN \`base_sys_menu\` reserve ON reserve.viewPath LIKE '%bsr-candidate-reserve.vue%'
      LEFT JOIN \`base_sys_role_menu\` existing
        ON existing.roleId = rm.roleId AND existing.menuId = reserve.id
      WHERE existing.id IS NULL
        AND (
          candidate4.router IN ('/app/bsr-candidate4', 'app/bsr-candidate4', '/app/candidate4', 'app/candidate4')
          OR candidate4.viewPath LIKE '%bsr-candidate4.vue%'
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ db: dbName }] = (await queryRunner.query(
      'SELECT DATABASE() as db'
    )) as Array<{ db: string }>;
    const requiredMenuTables = ['base_sys_menu', 'base_sys_role_menu'];
    const menuTables = (await queryRunner.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?, ?)`,
      [dbName, ...requiredMenuTables]
    )) as Array<{ TABLE_NAME: string }>;

    if (menuTables.length === requiredMenuTables.length) {
      await queryRunner.query(`
        DELETE rm FROM \`base_sys_role_menu\` rm
        JOIN \`base_sys_menu\` m ON m.id = rm.menuId
        WHERE m.router IN ('/app/bsr-candidate-reserve', 'app/bsr-candidate-reserve')
           OR m.viewPath LIKE '%bsr-candidate-reserve.vue%'
      `);
      await queryRunner.query(`
        DELETE FROM \`base_sys_menu\`
        WHERE router IN ('/app/bsr-candidate-reserve', 'app/bsr-candidate-reserve')
           OR viewPath LIKE '%bsr-candidate-reserve.vue%'
      `);
    }

    const [candidateTable] = (await queryRunner.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'app_amz_bsr_candidate'`,
      [dbName]
    )) as Array<{ TABLE_NAME: string }>;
    if (!candidateTable) return;

    const columns = (await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'app_amz_bsr_candidate'`,
      [dbName]
    )) as Array<{ COLUMN_NAME: string }>;
    const existing = new Set(columns.map(item => item.COLUMN_NAME));
    const dropColumn = async (name: string) => {
      if (existing.has(name)) {
        await queryRunner.query(
          `ALTER TABLE \`app_amz_bsr_candidate\` DROP COLUMN \`${name}\``
        );
      }
    };

    await dropColumn('reserve_reject_reason');
    await dropColumn('reserve_rejected_by_user_name');
    await dropColumn('reserve_rejected_by_user_id');
    await dropColumn('reserve_rejected_at');
    await dropColumn('reserved_by_user_name');
    await dropColumn('reserved_by_user_id');
    await dropColumn('reserved_at');
  }
}
