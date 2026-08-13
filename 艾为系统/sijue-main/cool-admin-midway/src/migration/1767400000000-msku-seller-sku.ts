import { MigrationInterface, QueryRunner } from 'typeorm';
import { Provide } from '@midwayjs/decorator';

/** app_amz_msku 上架 SKU（运营可改，内部 msku 不变） */
@Provide()
export class MskuSellerSku1767400000000 implements MigrationInterface {
  name = 'MskuSellerSku1767400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ db: dbName }] = (await queryRunner.query(`SELECT DATABASE() as db`)) as {
      db: string;
    }[];
    const cols = (await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'app_amz_msku'`,
      [dbName]
    )) as { COLUMN_NAME: string }[];
    if (!cols.some(c => c.COLUMN_NAME === 'seller_sku')) {
      await queryRunner.query(`
        ALTER TABLE \`app_amz_msku\`
        ADD \`seller_sku\` varchar(40) NULL COMMENT '上架 SKU（运营填写，空则上架时用系统 MSKU）'
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ db: dbName }] = (await queryRunner.query(`SELECT DATABASE() as db`)) as {
      db: string;
    }[];
    const cols = (await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'app_amz_msku'`,
      [dbName]
    )) as { COLUMN_NAME: string }[];
    if (cols.some(c => c.COLUMN_NAME === 'seller_sku')) {
      await queryRunner.query(`ALTER TABLE \`app_amz_msku\` DROP COLUMN \`seller_sku\``);
    }
  }
}
