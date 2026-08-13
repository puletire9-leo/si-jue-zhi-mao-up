import { MigrationInterface, QueryRunner } from 'typeorm';
import { Provide } from '@midwayjs/decorator';

@Provide()
export class ListingPriceHistory1766000000000 implements MigrationInterface {
  name = 'ListingPriceHistory1766000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ db: dbName }] = (await queryRunner.query(`SELECT DATABASE() as db`)) as { db: string }[];
    if (!dbName) return;

    const columns = (await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'app_amz_bsr_product_listing_lingxing'`,
      [dbName]
    )) as { COLUMN_NAME: string }[];
    const hasColumn = (name: string) => columns.some(column => column.COLUMN_NAME === name);

    if (!hasColumn('listing_price_history')) {
      await queryRunner.query(
        `ALTER TABLE \`app_amz_bsr_product_listing_lingxing\` ADD COLUMN \`listing_price_history\` JSON NULL COMMENT '售价数组（15天）' AFTER \`listing_price\``
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ db: dbName }] = (await queryRunner.query(`SELECT DATABASE() as db`)) as { db: string }[];
    if (!dbName) return;

    const columns = (await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'app_amz_bsr_product_listing_lingxing'`,
      [dbName]
    )) as { COLUMN_NAME: string }[];
    const hasColumn = (name: string) => columns.some(column => column.COLUMN_NAME === name);

    if (hasColumn('listing_price_history')) {
      await queryRunner.query(
        `ALTER TABLE \`app_amz_bsr_product_listing_lingxing\` DROP COLUMN \`listing_price_history\``
      );
    }
  }
}
