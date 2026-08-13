import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

@Provide()
export class BizLogicChange1715397043257 implements MigrationInterface {
  name = 'BizLogicChange1715397043257'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`app_amz_listing_keyword\` ADD \`search_volume_monthly\` int NULL COMMENT '月搜索量数据'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`app_amz_listing_keyword\` DROP COLUMN \`search_volume_monthly\``);
  }
}
