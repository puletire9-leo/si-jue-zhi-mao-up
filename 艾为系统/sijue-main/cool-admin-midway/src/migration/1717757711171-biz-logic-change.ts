import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * 关键词、竞品都添加 seller_sku 字段，因为那才是同一店铺下 Listing 的唯一标记
 */

@Provide()
export class BizLogicChange1717757711171 implements MigrationInterface {
  name = 'BizLogicChange1717757711171'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing_keyword\`
            ADD \`seller_sku\` varchar(255) NULL COMMENT 'MSKU'
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing_competitor\`
            ADD \`seller_sku\` varchar(255) NULL COMMENT 'MSKU'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing_competitor\` DROP COLUMN \`seller_sku\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing_keyword\` DROP COLUMN \`seller_sku\`
        `);
  }

}
