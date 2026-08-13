import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * Listing 表新增字段，用于区分是否自定义产品。
 */
@Provide()
export class BizLogicChange1716541737945 implements MigrationInterface {
  name = 'BizLogicChange1716541737945'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing\`
            ADD \`is_custom_listing\` int NULL COMMENT '是否自定义产品 0-否 1-是' DEFAULT '0'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing\` DROP COLUMN \`is_custom_listing\`
        `);
  }

}
