import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * 用于标记 Listing 是否停用，现主要用于自定义产品。
 */
@Provide()
export class BizLogicChange1720193437596 implements MigrationInterface {
  name = 'BizLogicChange1720193437596'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing\`
            ADD \`is_suspended\` int NULL COMMENT '是否停用 0-否 1-是' DEFAULT '0'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing\` DROP COLUMN \`is_suspended\`
        `);
  }

}
