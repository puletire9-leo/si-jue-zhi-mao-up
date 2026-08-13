import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * BSR 选品不需要区分国家，因此选品 ASIN 具有唯一性，所以改为通过选品的 ASIN 来关联其竞品。
 */
@Provide()
export class BizLogicChange1724750071588 implements MigrationInterface {
  name = 'BizLogicChange1724750071588'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_candidate_competitor\`
            ADD \`asin_candidate\` varchar(255) NOT NULL COMMENT 'BSR 选品的 ASIN'
        `);
    await queryRunner.query(`
            CREATE INDEX \`IDX_e3ddcd6db6fc97e2f96585c569\` ON \`app_amz_bsr_candidate_competitor\` (\`asin_candidate\`)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX \`IDX_e3ddcd6db6fc97e2f96585c569\` ON \`app_amz_bsr_candidate_competitor\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`app_amz_bsr_candidate_competitor\` DROP COLUMN \`asin_candidate\`
        `);
  }

}
