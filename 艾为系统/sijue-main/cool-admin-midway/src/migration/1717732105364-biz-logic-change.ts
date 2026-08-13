import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * 竞品（逐个）信息需要定期执行爬虫来更新，新增字段记录爬虫执行时间
 */
@Provide()
export class BizLogicChange1717732105364 implements MigrationInterface {
  name = 'BizLogicChange1717732105364'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing_competitor\`
            ADD \`spider_time\` datetime NULL COMMENT '产品信息爬虫的最近一次执行时间'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing_competitor\` DROP COLUMN \`spider_time\`
        `);
  }

}
