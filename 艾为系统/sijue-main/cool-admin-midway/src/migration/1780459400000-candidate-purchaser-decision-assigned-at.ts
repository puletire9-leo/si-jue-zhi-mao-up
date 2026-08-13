import { Provide } from '@midwayjs/decorator';
import { MigrationInterface, QueryRunner } from 'typeorm';

@Provide()
export class CandidatePurchaserDecisionAssignedAt1780459400000 implements MigrationInterface {
  name = 'CandidatePurchaserDecisionAssignedAt1780459400000';

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
        AND COLUMN_NAME = 'decision_assigned_at'
      `,
      [databaseName, table]
    );

    if (!columns.length) {
      await queryRunner.query(`
        ALTER TABLE \`${table}\`
        ADD \`decision_assigned_at\` datetime NULL COMMENT '进入待决策时间' AFTER \`reject_reason\`
      `);
    }

    await queryRunner.query(`
      UPDATE \`${table}\`
      SET \`decision_assigned_at\` = COALESCE(\`updateTime\`, \`createTime\`, NOW())
      WHERE \`is_generate\` = 1
        AND \`decision_assigned_at\` IS NULL
    `);

    const indexes = await queryRunner.query(
      `SHOW INDEX FROM \`${table}\` WHERE Key_name = 'idx_candidate_purchaser_decision_timeout'`
    );
    if (!indexes.length) {
      await queryRunner.query(`
        ALTER TABLE \`${table}\`
        ADD INDEX \`idx_candidate_purchaser_decision_timeout\` (\`is_generate\`, \`decision_assigned_at\`)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = 'app_amz_bsr_candidate_purchaser';
    const [schemaRow] = await queryRunner.query(`SELECT DATABASE() AS db`);
    const databaseName = schemaRow?.db;

    const indexes = await queryRunner.query(
      `SHOW INDEX FROM \`${table}\` WHERE Key_name = 'idx_candidate_purchaser_decision_timeout'`
    );
    if (indexes.length) {
      await queryRunner.query(`
        ALTER TABLE \`${table}\`
        DROP INDEX \`idx_candidate_purchaser_decision_timeout\`
      `);
    }

    const columns = await queryRunner.query(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND COLUMN_NAME = 'decision_assigned_at'
      `,
      [databaseName, table]
    );

    if (columns.length) {
      await queryRunner.query(`
        ALTER TABLE \`${table}\`
        DROP COLUMN \`decision_assigned_at\`
      `);
    }
  }
}
