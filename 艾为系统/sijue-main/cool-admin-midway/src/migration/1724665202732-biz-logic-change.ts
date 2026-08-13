import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * BSR 选品：新增了一些补充字段
 */
@Provide()
export class BizLogicChange1724665202732 implements MigrationInterface {
  name = 'BizLogicChange1724665202732'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_candidate\` DROP COLUMN \`is_fba\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_candidate\`
            ADD \`cost_price\` double(10, 2) NULL COMMENT '成本价'
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_candidate\`
            ADD \`fba_freight\` double(5, 2) NULL COMMENT 'FBA 配送费'
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_candidate\`
            ADD \`exchange_rate\` double(5, 2) NULL COMMENT '汇率'
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_candidate\`
            ADD \`factory_links\` json NULL COMMENT '工厂链接'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_candidate\` DROP COLUMN \`factory_links\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_candidate\` DROP COLUMN \`exchange_rate\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_candidate\` DROP COLUMN \`fba_freight\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_candidate\` DROP COLUMN \`cost_price\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_candidate\`
            ADD \`is_fba\` tinyint NOT NULL COMMENT 'FBA 配送 0-否 1-是' DEFAULT '0'
        `);
  }

}
