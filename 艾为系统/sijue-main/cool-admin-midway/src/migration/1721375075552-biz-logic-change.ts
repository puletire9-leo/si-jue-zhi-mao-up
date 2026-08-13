import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * 需求变更：店铺可直接授权到用户，而不是用户角色。
 * 因此类似对于角色表的修改，在用户表上新增一个字段，记录有权限访问的店铺 sid 列表。
 */
@Provide()
export class BizLogicChange1721375075552 implements MigrationInterface {
  name = 'BizLogicChange1721375075552'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`base_sys_user\`
            ADD \`sidList\` json NULL COMMENT '领星 ERP 店铺权限'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`base_sys_user\` DROP COLUMN \`sidList\`
        `);
  }

}
