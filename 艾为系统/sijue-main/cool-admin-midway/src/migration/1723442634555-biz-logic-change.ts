import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * 给关键词和竞品的 sid、asin、seller_sku 加上索引，提高查询速度。
 */
@Provide()
export class BizLogicChange1723442634555 implements MigrationInterface {
  name = 'BizLogicChange1723442634555'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE INDEX \`IDX_657e9ca4e513bdaf3b39defdf5\` ON \`app_amz_listing_keyword\` (\`sid\`)
        `);
    await queryRunner.query(`
            CREATE INDEX \`IDX_c7ab376db47c790c5f1e5e7d8c\` ON \`app_amz_listing_keyword\` (\`asin\`)
        `);
    await queryRunner.query(`
            CREATE INDEX \`IDX_f7d8208ac7ea9662a18737abcb\` ON \`app_amz_listing_keyword\` (\`seller_sku\`)
        `);
    await queryRunner.query(`
            CREATE INDEX \`IDX_0513965cf5c65826546a382e58\` ON \`app_amz_listing_competitor\` (\`sid\`)
        `);
    await queryRunner.query(`
            CREATE INDEX \`IDX_1eb9a3aac11840c098f177b0f3\` ON \`app_amz_listing_competitor\` (\`asin_mine\`)
        `);
    await queryRunner.query(`
            CREATE INDEX \`IDX_447eadbd7ea43569f29c5557a4\` ON \`app_amz_listing_competitor\` (\`seller_sku\`)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX \`IDX_447eadbd7ea43569f29c5557a4\` ON \`app_amz_listing_competitor\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_1eb9a3aac11840c098f177b0f3\` ON \`app_amz_listing_competitor\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_0513965cf5c65826546a382e58\` ON \`app_amz_listing_competitor\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_f7d8208ac7ea9662a18737abcb\` ON \`app_amz_listing_keyword\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_c7ab376db47c790c5f1e5e7d8c\` ON \`app_amz_listing_keyword\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_657e9ca4e513bdaf3b39defdf5\` ON \`app_amz_listing_keyword\`
        `);
  }

}
