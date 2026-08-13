import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

@Provide()
export class BizLogicChange1714375454810 implements MigrationInterface {
  name = 'BizLogicChange1714375454810'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`app_amz_listing\` ADD \`tactic_inventory_min_salable_days\` int NULL COMMENT '补货策略-最小可售天数（触发阈值）' DEFAULT '60'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`app_amz_listing\` DROP COLUMN \`tactic_inventory_min_salable_days\``);
  }

}
