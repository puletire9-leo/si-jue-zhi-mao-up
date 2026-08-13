import { Provide } from '@midwayjs/decorator';
import { MigrationInterface, QueryRunner } from 'typeorm';

@Provide()
export class CandidatePurchasePlanPurchaserRecordId1780459600000 implements MigrationInterface {
  name = 'CandidatePurchasePlanPurchaserRecordId1780459600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = 'app_amz_bsr_candidate_purchase_plan';
    const [schemaRow] = await queryRunner.query(`SELECT DATABASE() AS db`);
    const databaseName = schemaRow?.db;
    const columns = await queryRunner.query(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND COLUMN_NAME = 'purchaser_record_id'
      `,
      [databaseName, table]
    );

    if (!columns.length) {
      await queryRunner.query(`
        ALTER TABLE \`${table}\`
        ADD \`purchaser_record_id\` int NULL COMMENT '采购分配记录ID' AFTER \`store_id\`
      `);
    }

    const indexes = await queryRunner.query(
      `SHOW INDEX FROM \`${table}\` WHERE Key_name = 'idx_candidate_purchase_plan_purchaser_record'`
    );
    if (!indexes.length) {
      await queryRunner.query(`
        ALTER TABLE \`${table}\`
        ADD INDEX \`idx_candidate_purchase_plan_purchaser_record\` (\`purchaser_record_id\`)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = 'app_amz_bsr_candidate_purchase_plan';
    const [schemaRow] = await queryRunner.query(`SELECT DATABASE() AS db`);
    const databaseName = schemaRow?.db;

    const indexes = await queryRunner.query(
      `SHOW INDEX FROM \`${table}\` WHERE Key_name = 'idx_candidate_purchase_plan_purchaser_record'`
    );
    if (indexes.length) {
      await queryRunner.query(`
        ALTER TABLE \`${table}\`
        DROP INDEX \`idx_candidate_purchase_plan_purchaser_record\`
      `);
    }

    const columns = await queryRunner.query(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND COLUMN_NAME = 'purchaser_record_id'
      `,
      [databaseName, table]
    );

    if (columns.length) {
      await queryRunner.query(`
        ALTER TABLE \`${table}\`
        DROP COLUMN \`purchaser_record_id\`
      `);
    }
  }
}
