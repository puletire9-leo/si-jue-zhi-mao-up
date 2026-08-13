import { MigrationInterface, QueryRunner } from 'typeorm';
import { Provide } from '@midwayjs/decorator';

@Provide()
export class SalesCacheAddMskuUnique1765000000000 implements MigrationInterface {
  name = 'SalesCacheAddMskuUnique1765000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ db: dbName }] = (await queryRunner.query(`SELECT DATABASE() as db`)) as { db: string }[];
    if (!dbName) return;

    const indexes = (await queryRunner.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'app_amz_bsr_sales_cache_lingxing'`,
      [dbName]
    )) as { INDEX_NAME: string }[];
    const hasIndex = (name: string) => indexes.some(index => index.INDEX_NAME === name);

    await queryRunner.query(
      `UPDATE \`app_amz_bsr_sales_cache_lingxing\` SET \`msku\` = '' WHERE \`msku\` IS NULL`
    );

    if (hasIndex('uk_store_asin_market')) {
      await queryRunner.query(
        `ALTER TABLE \`app_amz_bsr_sales_cache_lingxing\` DROP INDEX \`uk_store_asin_market\``
      );
    }

    if (!hasIndex('uk_store_asin_market_msku')) {
      await queryRunner.query(
        `ALTER TABLE \`app_amz_bsr_sales_cache_lingxing\` ADD UNIQUE KEY \`uk_store_asin_market_msku\` (\`store_id\`, \`asin\`, \`marketplace\`, \`msku\`)`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ db: dbName }] = (await queryRunner.query(`SELECT DATABASE() as db`)) as { db: string }[];
    if (!dbName) return;

    const indexes = (await queryRunner.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'app_amz_bsr_sales_cache_lingxing'`,
      [dbName]
    )) as { INDEX_NAME: string }[];
    const hasIndex = (name: string) => indexes.some(index => index.INDEX_NAME === name);

    if (hasIndex('uk_store_asin_market_msku')) {
      await queryRunner.query(
        `ALTER TABLE \`app_amz_bsr_sales_cache_lingxing\` DROP INDEX \`uk_store_asin_market_msku\``
      );
    }

    if (!hasIndex('uk_store_asin_market')) {
      await queryRunner.query(
        `ALTER TABLE \`app_amz_bsr_sales_cache_lingxing\` ADD UNIQUE KEY \`uk_store_asin_market\` (\`store_id\`, \`asin\`, \`marketplace\`)`
      );
    }
  }
}
