import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * BSR 任务的几个字段类型，从 decimal 改为 double
 */
@Provide()
export class BizLogicChange1724922280060 implements MigrationInterface {
  name = 'BizLogicChange1724922280060'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_task\` DROP COLUMN \`price_min\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_task\`
            ADD \`price_min\` double(10, 2) NULL COMMENT '价格最小值'
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_task\` DROP COLUMN \`weight_min\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_task\`
            ADD \`weight_min\` double(10, 2) NULL COMMENT '重量最小值'
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_task\` DROP COLUMN \`weight_max\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_task\`
            ADD \`weight_max\` double(10, 2) NULL COMMENT '重量最大值'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_task\` DROP COLUMN \`weight_max\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_task\`
            ADD \`weight_max\` decimal(10, 2) NULL COMMENT '重量最大值'
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_task\` DROP COLUMN \`weight_min\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_task\`
            ADD \`weight_min\` decimal(10, 2) NULL COMMENT '重量最小值'
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_task\` DROP COLUMN \`price_min\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_task\`
            ADD \`price_min\` decimal(10, 2) NULL COMMENT '价格最小值'
        `);
  }

}
