import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * BSR 选品：增加字段：关键词搜索量截图
 */
@Provide()
export class BizLogicChange1725009177612 implements MigrationInterface {
  name = 'BizLogicChange1725009177612'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_candidate\`
            ADD \`keyword_screenshots\` json NULL COMMENT '关键词搜索量截图'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_candidate\` DROP COLUMN \`keyword_screenshots\`
        `);
  }

}
