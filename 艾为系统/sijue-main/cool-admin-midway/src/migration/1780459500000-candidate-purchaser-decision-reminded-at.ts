import { Provide } from '@midwayjs/decorator';
import { MigrationInterface, QueryRunner } from 'typeorm';

@Provide()
export class CandidatePurchaserDecisionRemindedAt1780459500000 implements MigrationInterface {
  name = 'CandidatePurchaserDecisionRemindedAt1780459500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = 'app_amz_bsr_candidate_purchaser';
    const [schemaRow] = await queryRunner.query(`SELECT DATABASE() AS db`);
    const databaseName = schemaRow?.db;
    const columns = await queryRunner.query(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND COLUMN_NAME = 'decision_reminded_at'
      `,
      [databaseName, table]
    );

    if (!columns.length) {
      await queryRunner.query(`
        ALTER TABLE \`${table}\`
        ADD \`decision_reminded_at\` datetime NULL COMMENT '待决策钉钉提醒时间' AFTER \`decision_assigned_at\`
      `);
    }

    const indexes = await queryRunner.query(
      `SHOW INDEX FROM \`${table}\` WHERE Key_name = 'idx_candidate_purchaser_decision_reminder'`
    );
    if (!indexes.length) {
      await queryRunner.query(`
        ALTER TABLE \`${table}\`
        ADD INDEX \`idx_candidate_purchaser_decision_reminder\` (\`is_generate\`, \`decision_reminded_at\`, \`decision_assigned_at\`)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = 'app_amz_bsr_candidate_purchaser';
    const [schemaRow] = await queryRunner.query(`SELECT DATABASE() AS db`);
    const databaseName = schemaRow?.db;

    const indexes = await queryRunner.query(
      `SHOW INDEX FROM \`${table}\` WHERE Key_name = 'idx_candidate_purchaser_decision_reminder'`
    );
    if (indexes.length) {
      await queryRunner.query(`
        ALTER TABLE \`${table}\`
        DROP INDEX \`idx_candidate_purchaser_decision_reminder\`
      `);
    }

    const columns = await queryRunner.query(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND COLUMN_NAME = 'decision_reminded_at'
      `,
      [databaseName, table]
    );

    if (columns.length) {
      await queryRunner.query(`
        ALTER TABLE \`${table}\`
        DROP COLUMN \`decision_reminded_at\`
      `);
    }
  }
}
