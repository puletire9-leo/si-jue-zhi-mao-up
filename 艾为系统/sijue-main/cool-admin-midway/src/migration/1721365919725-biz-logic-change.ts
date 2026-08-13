import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * 竞品 bullet points 的内容可能会很长，修改为 text 类型。
 */
@Provide()
export class BizLogicChange1721365919725 implements MigrationInterface {
  name = 'BizLogicChange1721365919725'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing_competitor\` CHANGE \`bsr_html\` \`bsr_html\` varchar(10000) NULL COMMENT 'BSR 信息（直接从商品详情页面摘取的文字）'
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing_competitor\` CHANGE \`bullet_points\` \`bullet_points\` text NULL COMMENT '五点描述'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing_competitor\` CHANGE \`bullet_points\` \`bullet_points\` varchar(3000) NULL COMMENT '五点描述'
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing_competitor\` CHANGE \`bsr_html\` \`bsr_html\` varchar(10000) NULL COMMENT 'BSR 信息（直接从商品详情页面摘取的 HTML 片段）'
        `);
  }

}
