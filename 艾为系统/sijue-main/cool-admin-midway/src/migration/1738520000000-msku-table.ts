import { MigrationInterface, QueryRunner } from 'typeorm';
import { Provide } from '@midwayjs/decorator';

/**
 * MSKU 主表（msku 业务编号为主键）+ 采购表 msku 字段。
 * 含 selected_variant_id、第一次入库提交人 submitter_user_id / submitter_name。
 */
@Provide()
export class MskuTable1738510000000 implements MigrationInterface {
  name = 'MskuTable1738510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ db: dbName }] = await queryRunner.query(`SELECT DATABASE() as db`) as { db: string }[];

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_amz_msku\` (
        \`msku\` varchar(128) NOT NULL COMMENT 'MSKU 业务编号',
        \`candidate_id\` varchar(64) NULL COMMENT '选品ID',
        \`candidate_name\` varchar(200) NULL COMMENT '选品名称',
        \`seller_id\` varchar(64) NULL COMMENT '卖家ID',
        \`seller_name\` varchar(255) NULL COMMENT '卖家账户名称',
        \`selected_variant\` varchar(255) NULL COMMENT '变体名称',
        \`selected_variant_id\` varchar(36) NULL COMMENT '变体 id（app_amz_bsr_candidate_variant.id）',
        \`submitter_user_id\` varchar(64) NULL COMMENT '第一次入库时的提交人用户ID',
        \`submitter_name\` varchar(128) NULL COMMENT '第一次入库时的提交人名称',
        \`createTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updateTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`msku\`),
        UNIQUE KEY \`UQ_candidate_seller_variant\` (\`candidate_id\`, \`seller_id\`, \`selected_variant\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='MSKU 主表'
    `);

    const cols = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [dbName, 'app_amz_bsr_candidate_purchaser']
    ) as Array<{ COLUMN_NAME: string }>;
    const hasMsku = cols.some((c) => c.COLUMN_NAME === 'msku');
    if (!hasMsku) {
      await queryRunner.query(`
        ALTER TABLE \`app_amz_bsr_candidate_purchaser\`
        ADD \`msku\` varchar(128) NULL COMMENT 'MSKU 业务编号'
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ db: dbName }] = await queryRunner.query(`SELECT DATABASE() as db`) as { db: string }[];
    const cols = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [dbName, 'app_amz_bsr_candidate_purchaser']
    ) as Array<{ COLUMN_NAME: string }>;
    const hasMsku = cols.some((c) => c.COLUMN_NAME === 'msku');
    if (hasMsku) {
      await queryRunner.query(`
        ALTER TABLE \`app_amz_bsr_candidate_purchaser\` DROP COLUMN \`msku\`
      `);
    }
    await queryRunner.query(`DROP TABLE IF EXISTS \`app_amz_msku\``);
  }
}
