import { Provide } from '@midwayjs/decorator';
import { MigrationInterface, QueryRunner } from 'typeorm';

@Provide()
export class CandidatePurchaserRejectReason1780459200000
  implements MigrationInterface
{
  name = 'CandidatePurchaserRejectReason1780459200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = 'app_amz_bsr_candidate_purchaser';
    const [{ db: dbName }] = (await queryRunner.query(
      'SELECT DATABASE() as db'
    )) as Array<{ db: string }>;
    const tables = (await queryRunner.query(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
      [dbName, table]
    )) as Array<{ TABLE_NAME: string }>;
    if (tables.length === 0) return;

    const columns = (await queryRunner.query(
      'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
      [dbName, table]
    )) as Array<{ COLUMN_NAME: string }>;
    if (!columns.some(column => column.COLUMN_NAME === 'reject_reason')) {
      await queryRunner.query(`
        ALTER TABLE \`${table}\`
        ADD \`reject_reason\` text NULL COMMENT '不做理由' AFTER \`procurement\`
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = 'app_amz_bsr_candidate_purchaser';
    const [{ db: dbName }] = (await queryRunner.query(
      'SELECT DATABASE() as db'
    )) as Array<{ db: string }>;
    const columns = (await queryRunner.query(
      'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
      [dbName, table]
    )) as Array<{ COLUMN_NAME: string }>;
    if (columns.some(column => column.COLUMN_NAME === 'reject_reason')) {
      await queryRunner.query(`
        ALTER TABLE \`${table}\`
        DROP COLUMN \`reject_reason\`
      `);
    }
  }
}
