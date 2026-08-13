import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * BSR 选品：增加字段 bsr 榜单链接 和 国家，复制自相关任务。
 */
@Provide()
export class BizLogicChange1724658491887 implements MigrationInterface {
  name = 'BizLogicChange1724658491887'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_candidate\`
            ADD \`bsr_link\` varchar(255) NOT NULL COMMENT 'BSR 的 URL 链接'
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_candidate\`
            ADD \`marketplace\` varchar(20) NOT NULL COMMENT '国家'
        `);
    await queryRunner.query(`
            CREATE INDEX \`IDX_d7b922315b9d90b07a4553c76e\` ON \`app_amz_bsr_candidate\` (\`asin\`)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX \`IDX_d7b922315b9d90b07a4553c76e\` ON \`app_amz_bsr_candidate\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_candidate\` DROP COLUMN \`marketplace\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_candidate\` DROP COLUMN \`bsr_link\`
        `);
  }

}
