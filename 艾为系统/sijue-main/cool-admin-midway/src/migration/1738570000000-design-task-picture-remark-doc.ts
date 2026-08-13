import { MigrationInterface, QueryRunner } from 'typeorm';
import { Provide } from '@midwayjs/decorator';

@Provide()
export class DesignTaskPictureRemarkDoc1738570000000 implements MigrationInterface {
  name = 'DesignTaskPictureRemarkDoc1738570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`design_task_picture\`
      ADD COLUMN \`remark_doc\` json DEFAULT NULL COMMENT '运营补充说明 { text?, images? }' AFTER \`requirements\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`design_task_picture\` DROP COLUMN \`remark_doc\`
    `);
  }
}
