import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * 给 Listing 的 sid、asin、seller_sku 加上索引，提高查询速度。
 */
@Provide()
export class BizLogicChange1723444200667 implements MigrationInterface {
  name = 'BizLogicChange1723444200667'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE INDEX \`IDX_1b4e4b1df9ab3e54701197716a\` ON \`app_amz_listing\` (\`sid\`)
        `);
    await queryRunner.query(`
            CREATE INDEX \`IDX_e26a2ac95551c69dc82792af56\` ON \`app_amz_listing\` (\`seller_sku\`)
        `);
    await queryRunner.query(`
            CREATE INDEX \`IDX_2ed0c244b2303146da58a0abb6\` ON \`app_amz_listing\` (\`asin\`)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX \`IDX_2ed0c244b2303146da58a0abb6\` ON \`app_amz_listing\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_e26a2ac95551c69dc82792af56\` ON \`app_amz_listing\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_1b4e4b1df9ab3e54701197716a\` ON \`app_amz_listing\`
        `);
  }

}
