import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * 新品调价预期日单量：需支持填写小数。
 */
@Provide()
export class BizLogicChange1719206884876 implements MigrationInterface {
  name = 'BizLogicChange1719206884876'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing\` DROP COLUMN \`tactic_new_product_expected_daily_order_quantity\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing\`
            ADD \`tactic_new_product_expected_daily_order_quantity\` double NULL COMMENT '新品调价策略-新品预期日单量'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing\` DROP COLUMN \`tactic_new_product_expected_daily_order_quantity\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_listing\`
            ADD \`tactic_new_product_expected_daily_order_quantity\` int NULL COMMENT '新品调价策略-新品预期日单量'
        `);
  }

}
