import { Provide } from '@midwayjs/decorator';
import { MigrationInterface, QueryRunner } from 'typeorm';

@Provide()
export class AppErrorLogSystemMenu1780715400000 implements MigrationInterface {
  name = 'AppErrorLogSystemMenu1780715400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ db: dbName }] = (await queryRunner.query(
      'SELECT DATABASE() as db'
    )) as Array<{ db: string }>;
    const requiredMenuTables = ['base_sys_menu', 'base_sys_role_menu'];
    const menuTables = (await queryRunner.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?, ?)`,
      [dbName, ...requiredMenuTables]
    )) as Array<{ TABLE_NAME: string }>;
    if (menuTables.length < requiredMenuTables.length) return;

    await queryRunner.query(`
      UPDATE \`base_sys_menu\` error_log
      JOIN \`base_sys_menu\` source
        ON (
          source.router IN ('/sys/log', 'sys/log')
          OR source.viewPath IN ('cool/modules/base/views/log.vue', 'modules/base/views/log.vue')
          OR source.viewPath LIKE '%modules/base/views/log.vue%'
        )
      SET error_log.parentId = source.parentId,
          error_log.name = '系统错误日志',
          error_log.router = '/sys/error-log',
          error_log.perms = NULL,
          error_log.type = 1,
          error_log.icon = source.icon,
          error_log.orderNum = source.orderNum + 1,
          error_log.viewPath = 'modules/app/views/error_log.vue',
          error_log.keepAlive = source.keepAlive,
          error_log.isShow = true
      WHERE error_log.router IN ('/app/error-log', 'app/error-log', '/sys/error-log', 'sys/error-log')
         OR error_log.viewPath LIKE '%error_log.vue%'
    `);

    await queryRunner.query(`
      INSERT INTO \`base_sys_menu\` (\`parentId\`, \`name\`, \`router\`, \`perms\`, \`type\`, \`icon\`, \`orderNum\`, \`viewPath\`, \`keepAlive\`, \`isShow\`)
      SELECT source.parentId, '系统错误日志', '/sys/error-log', NULL, 1, source.icon, source.orderNum + 1,
             'modules/app/views/error_log.vue', source.keepAlive, true
      FROM \`base_sys_menu\` source
      WHERE (
          source.router IN ('/sys/log', 'sys/log')
          OR source.viewPath IN ('cool/modules/base/views/log.vue', 'modules/base/views/log.vue')
          OR source.viewPath LIKE '%modules/base/views/log.vue%'
        )
        AND NOT EXISTS (
          SELECT 1 FROM \`base_sys_menu\` existing_menu
          WHERE existing_menu.router IN ('/app/error-log', 'app/error-log', '/sys/error-log', 'sys/error-log')
             OR existing_menu.viewPath LIKE '%error_log.vue%'
        )
      LIMIT 1
    `);

    await queryRunner.query(`
      INSERT INTO \`base_sys_role_menu\` (\`roleId\`, \`menuId\`)
      SELECT rm.roleId, error_log.id
      FROM \`base_sys_role_menu\` rm
      JOIN \`base_sys_menu\` source ON source.id = rm.menuId
      JOIN \`base_sys_menu\` error_log ON error_log.viewPath LIKE '%error_log.vue%'
      LEFT JOIN \`base_sys_role_menu\` existing_rm
        ON existing_rm.roleId = rm.roleId AND existing_rm.menuId = error_log.id
      WHERE existing_rm.id IS NULL
        AND (
          source.router IN ('/sys/log', 'sys/log')
          OR source.viewPath IN ('cool/modules/base/views/log.vue', 'modules/base/views/log.vue')
          OR source.viewPath LIKE '%modules/base/views/log.vue%'
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
        WHERE m.router IN ('/sys/error-log', 'sys/error-log')
           OR m.viewPath LIKE '%error_log.vue%'
      `);
      await queryRunner.query(`
        DELETE FROM \`base_sys_menu\`
        WHERE router IN ('/sys/error-log', 'sys/error-log')
           OR viewPath LIKE '%error_log.vue%'
      `);
    }
  }
}
