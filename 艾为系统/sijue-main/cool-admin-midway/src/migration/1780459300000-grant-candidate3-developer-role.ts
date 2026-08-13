import { Provide } from '@midwayjs/decorator';
import { MigrationInterface, QueryRunner } from 'typeorm';

@Provide()
export class GrantCandidate3DeveloperRole1780459300000
  implements MigrationInterface
{
  name = 'GrantCandidate3DeveloperRole1780459300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ db: dbName }] = (await queryRunner.query(
      'SELECT DATABASE() as db'
    )) as Array<{ db: string }>;
    const requiredTables = ['base_sys_role', 'base_sys_menu', 'base_sys_role_menu'];
    const tables = (await queryRunner.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?, ?, ?)`,
      [dbName, ...requiredTables]
    )) as Array<{ TABLE_NAME: string }>;
    if (tables.length < requiredTables.length) return;

    await queryRunner.query(`
      INSERT INTO \`base_sys_role_menu\` (\`roleId\`, \`menuId\`)
      SELECT r.id, m.id
      FROM \`base_sys_role\` r
      JOIN \`base_sys_menu\` m
        ON (
          m.router IN ('/app/candidate3', 'app/candidate3', '/app/bsr-candidate3', 'app/bsr-candidate3')
          OR m.viewPath LIKE '%bsr-candidate3.vue%'
        )
      LEFT JOIN \`base_sys_role_menu\` rm
        ON rm.roleId = r.id AND rm.menuId = m.id
      WHERE rm.id IS NULL
        AND (
          r.name IN ('开发', '运营')
          OR r.label IN ('开发', '运营')
          OR LOWER(r.name) LIKE '%developer%'
          OR LOWER(r.label) LIKE '%developer%'
          OR LOWER(r.name) IN ('operation', 'operator', 'operations')
          OR LOWER(r.label) IN ('operation', 'operator', 'operations')
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ db: dbName }] = (await queryRunner.query(
      'SELECT DATABASE() as db'
    )) as Array<{ db: string }>;
    const requiredTables = ['base_sys_role', 'base_sys_menu', 'base_sys_role_menu'];
    const tables = (await queryRunner.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?, ?, ?)`,
      [dbName, ...requiredTables]
    )) as Array<{ TABLE_NAME: string }>;
    if (tables.length < requiredTables.length) return;

    await queryRunner.query(`
      DELETE rm
      FROM \`base_sys_role_menu\` rm
      JOIN \`base_sys_role\` r ON r.id = rm.roleId
      JOIN \`base_sys_menu\` m ON m.id = rm.menuId
      WHERE (
          m.router IN ('/app/candidate3', 'app/candidate3', '/app/bsr-candidate3', 'app/bsr-candidate3')
          OR m.viewPath LIKE '%bsr-candidate3.vue%'
        )
        AND (
          r.name IN ('开发', '运营')
          OR r.label IN ('开发', '运营')
          OR LOWER(r.name) LIKE '%developer%'
          OR LOWER(r.label) LIKE '%developer%'
          OR LOWER(r.name) IN ('operation', 'operator', 'operations')
          OR LOWER(r.label) IN ('operation', 'operator', 'operations')
        )
    `);
  }
}
