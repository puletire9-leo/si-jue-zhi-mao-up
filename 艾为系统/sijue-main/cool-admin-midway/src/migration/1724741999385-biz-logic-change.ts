import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * BSR 任务：配送方式需支持多选，字段改为 json 格式。
 */
@Provide()
export class BizLogicChange1724741999385 implements MigrationInterface {
  name = 'BizLogicChange1724741999385'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_task\` DROP COLUMN \`delivery_type\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_task\`
            ADD \`delivery_type\` json NULL COMMENT '配送方式 0-⾃营 1-FBA 2-FBM'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_task\` DROP COLUMN \`delivery_type\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_task\`
            ADD \`delivery_type\` tinyint NULL COMMENT '配送方式 0-⾃营 1-FBA 2-FBM' DEFAULT '0'
        `);
  }

}
