import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * 2024-06-18 需要对所有关键词记录每月更新当月搜索量，因此新增一个字段，记录查询搜索量的时间。
 */
@Provide()
export class BizLogicChange1718695479276 implements MigrationInterface {
  name = 'BizLogicChange1718695479276'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing_keyword\`
            ADD \`search_volume_monthly_update_time\` datetime NULL COMMENT '月搜索量数据查询日期'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing_keyword\` DROP COLUMN \`search_volume_monthly_update_time\`
        `);
  }

}
