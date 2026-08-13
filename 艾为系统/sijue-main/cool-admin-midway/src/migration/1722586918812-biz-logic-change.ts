import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * 日均单量精化计算，需记录历史销量。
 */
@Provide()
export class BizLogicChange1722586918812 implements MigrationInterface {
  name = 'BizLogicChange1722586918812'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_seller\`
            ADD \`daily_order_quantity_history_updateTime\` datetime NULL COMMENT '最近一次拉取 listing 销量数据的时间'
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing\`
            ADD \`daily_order_quantity_history\` json NULL COMMENT '历史日单量数据'
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing\`
            ADD \`landed_price_updateTime\` datetime NULL COMMENT '检测到价格变动的时间'
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing\`
            ADD \`daily_order_quantity_status\` tinyint NOT NULL COMMENT '日均单量状态 0-待计算 1-有效' DEFAULT '1'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing\` DROP COLUMN \`daily_order_quantity_status\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing\` DROP COLUMN \`landed_price_updateTime\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing\` DROP COLUMN \`daily_order_quantity_history\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_seller\` DROP COLUMN \`daily_order_quantity_history_updateTime\`
        `);
  }

}
