import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

@Provide()
export class BizLogicChange1714294625617 implements MigrationInterface {
  name = 'BizLogicChange1714294625617'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`app_amz_listing\` ADD \`competitor_amount_history\` json NULL COMMENT '竞品数量历史'`);
    await queryRunner.query(`ALTER TABLE \`app_amz_listing\` ADD \`competitor_amount_history_updateTime\` datetime NULL COMMENT '竞品数量历史统计时间'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`app_amz_listing\` DROP COLUMN \`competitor_amount_history_updateTime\``);
    await queryRunner.query(`ALTER TABLE \`app_amz_listing\` DROP COLUMN \`competitor_amount_history\``);
  }
}


