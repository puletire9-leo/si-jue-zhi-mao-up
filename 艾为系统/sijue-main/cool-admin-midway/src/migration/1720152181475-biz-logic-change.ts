import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * 竞品信息，需追加爬取：配送方、售卖方、五点描述。
 */
@Provide()
export class BizLogicChange1720152181475 implements MigrationInterface {
  name = 'BizLogicChange1720152181475'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing_competitor\`
            ADD \`dispatches_from\` varchar(255) NULL COMMENT '配送方'
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing_competitor\`
            ADD \`sold_by\` varchar(255) NULL COMMENT '售卖方'
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing_competitor\`
            ADD \`bullet_points\` varchar(3000) NULL COMMENT '五点描述'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing_competitor\` DROP COLUMN \`bullet_points\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing_competitor\` DROP COLUMN \`sold_by\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing_competitor\` DROP COLUMN \`dispatches_from\`
        `);
  }

}
