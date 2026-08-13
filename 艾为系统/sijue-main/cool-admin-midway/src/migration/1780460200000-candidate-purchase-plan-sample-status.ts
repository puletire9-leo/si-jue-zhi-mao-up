import { Provide } from '@midwayjs/decorator';
import { MigrationInterface, QueryRunner } from 'typeorm';

@Provide()
export class CandidatePurchasePlanSampleStatus1780460200000 implements MigrationInterface {
  name = 'CandidatePurchasePlanSampleStatus1780460200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = 'app_amz_bsr_candidate_purchase_plan';
    const databaseName = await this.getDatabaseName(queryRunner);
    const columns = await this.getColumns(queryRunner, databaseName, table);
    const hasColumn = (name: string) => columns.some(column => column.COLUMN_NAME === name);

    const adds: string[] = [];
    if (!hasColumn('sample_status')) {
      adds.push(
        "`sample_status` tinyint NOT NULL DEFAULT 1 COMMENT '样品采购系统状态 1=已下单 2=已采购 3=已完成' AFTER `type`"
      );
    }
    if (!hasColumn('sample_completed_time')) {
      adds.push(
        "`sample_completed_time` datetime NULL COMMENT '样品采购人工完成时间' AFTER `sample_status`"
      );
    }
    if (!hasColumn('sample_completed_by')) {
      adds.push(
        "`sample_completed_by` int NULL COMMENT '样品采购人工完成人ID' AFTER `sample_completed_time`"
      );
    }
    if (!hasColumn('sample_completed_by_name')) {
      adds.push(
        "`sample_completed_by_name` varchar(64) NULL COMMENT '样品采购人工完成人' AFTER `sample_completed_by`"
      );
    }

    if (adds.length) {
      await queryRunner.query(`ALTER TABLE \`${table}\` ADD ${adds.join(', ADD ')}`);
    }

    const indexes = await queryRunner.query(
      `SHOW INDEX FROM \`${table}\` WHERE Key_name = 'idx_candidate_purchase_plan_sample_status'`
    );
    if (!indexes.length) {
      await queryRunner.query(
        `ALTER TABLE \`${table}\` ADD INDEX \`idx_candidate_purchase_plan_sample_status\` (\`sample_status\`)`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = 'app_amz_bsr_candidate_purchase_plan';
    const databaseName = await this.getDatabaseName(queryRunner);

    const indexes = await queryRunner.query(
      `SHOW INDEX FROM \`${table}\` WHERE Key_name = 'idx_candidate_purchase_plan_sample_status'`
    );
    if (indexes.length) {
      await queryRunner.query(
        `ALTER TABLE \`${table}\` DROP INDEX \`idx_candidate_purchase_plan_sample_status\``
      );
    }

    const columns = await this.getColumns(queryRunner, databaseName, table);
    const hasColumn = (name: string) => columns.some(column => column.COLUMN_NAME === name);
    const drops = [
      'sample_completed_by_name',
      'sample_completed_by',
      'sample_completed_time',
      'sample_status',
    ]
      .filter(hasColumn)
      .map(name => `DROP COLUMN \`${name}\``);

    if (drops.length) {
      await queryRunner.query(`ALTER TABLE \`${table}\` ${drops.join(', ')}`);
    }
  }

  private async getDatabaseName(queryRunner: QueryRunner): Promise<string> {
    const [schemaRow] = await queryRunner.query(`SELECT DATABASE() AS db`);
    return schemaRow?.db;
  }

  private async getColumns(queryRunner: QueryRunner, databaseName: string, table: string) {
    return queryRunner.query(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND COLUMN_NAME IN (
          'sample_status',
          'sample_completed_time',
          'sample_completed_by',
          'sample_completed_by_name'
        )
      `,
      [databaseName, table]
    );
  }
}
