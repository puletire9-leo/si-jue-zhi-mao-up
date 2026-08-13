import { Provide } from '@midwayjs/decorator';
import { MigrationInterface, QueryRunner } from 'typeorm';

@Provide()
export class LingxingDataFetchMode1780372800000 implements MigrationInterface {
  name = 'LingxingDataFetchMode1780372800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = 'base_sys_param';
    const keyName = 'lingxing_data_fetch_mode';
    const [{ db: dbName }] = (await queryRunner.query(
      'SELECT DATABASE() as db'
    )) as Array<{ db: string }>;
    const tables = (await queryRunner.query(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
      [dbName, table]
    )) as Array<{ TABLE_NAME: string }>;
    if (tables.length === 0) return;

    const existing = (await queryRunner.query(
      'SELECT id FROM `base_sys_param` WHERE `keyName` = ? LIMIT 1',
      [keyName]
    )) as Array<{ id: number }>;
    if (existing.length > 0) return;

    const columns = (await queryRunner.query(
      'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
      [dbName, table]
    )) as Array<{ COLUMN_NAME: string }>;
    const columnSet = new Set(columns.map(column => column.COLUMN_NAME));
    const insertColumns: string[] = [];
    const placeholders: string[] = [];
    const values: any[] = [];
    const addValue = (column: string, value: any) => {
      if (!columnSet.has(column)) return;
      insertColumns.push(`\`${column}\``);
      placeholders.push('?');
      values.push(value);
    };
    const addNow = (column: string) => {
      if (!columnSet.has(column)) return;
      insertColumns.push(`\`${column}\``);
      placeholders.push('NOW()');
    };

    addValue('keyName', keyName);
    addValue('name', '领星数据获取方式');
    addValue('data', '1');
    addValue('dataType', 0);
    addValue('remark', '1=网页登录抓取，2=领星开放API');
    addNow('createTime');
    addNow('updateTime');

    await queryRunner.query(
      `INSERT INTO \`${table}\` (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`,
      values
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = 'base_sys_param';
    const [{ db: dbName }] = (await queryRunner.query(
      'SELECT DATABASE() as db'
    )) as Array<{ db: string }>;
    const tables = (await queryRunner.query(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
      [dbName, table]
    )) as Array<{ TABLE_NAME: string }>;
    if (tables.length === 0) return;

    await queryRunner.query(
      'DELETE FROM `base_sys_param` WHERE `keyName` = ?',
      ['lingxing_data_fetch_mode']
    );
  }
}
