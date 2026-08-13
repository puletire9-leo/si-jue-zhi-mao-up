import { MigrationInterface, QueryRunner } from 'typeorm';
import { Provide } from '@midwayjs/decorator';

/**
 * BSR 选品变体表：添加英国标题和德国标题字段
 */
@Provide()
export class AddVariantTitles1738600000000 implements MigrationInterface {
  name = 'AddVariantTitles1738600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 添加英国标题字段
    await queryRunner.query(`
      ALTER TABLE app_amz_bsr_candidate_variant 
      ADD COLUMN uk_title VARCHAR(500) NULL COMMENT '英国标题' AFTER group_proportions
    `);

    // 添加德国标题字段
    await queryRunner.query(`
      ALTER TABLE app_amz_bsr_candidate_variant 
      ADD COLUMN de_title VARCHAR(500) NULL COMMENT '德国标题' AFTER uk_title
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 移除德国标题字段
    await queryRunner.query(`
      ALTER TABLE app_amz_bsr_candidate_variant 
      DROP COLUMN de_title
    `);

    // 移除英国标题字段
    await queryRunner.query(`
      ALTER TABLE app_amz_bsr_candidate_variant 
      DROP COLUMN uk_title
    `);
  }
}