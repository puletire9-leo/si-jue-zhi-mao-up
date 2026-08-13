import { MigrationInterface, QueryRunner } from 'typeorm';
import { Provide } from '@midwayjs/decorator';

@Provide()
export class UserListingCommonSuffix1767300000000 implements MigrationInterface {
  name = 'UserListingCommonSuffix1767300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_user_listing_common_suffix\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`user_id\` int NOT NULL COMMENT '用户ID',
        \`use_scene\` varchar(255) NOT NULL COMMENT '使用场景',
        \`suffix_en\` varchar(500) DEFAULT NULL COMMENT '英文后缀',
        \`suffix_de\` varchar(500) DEFAULT NULL COMMENT '德文后缀',
        \`sort_order\` int NOT NULL DEFAULT 0 COMMENT '排序（越小越靠前）',
        \`createTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updateTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_user_listing_common_suffix\` (\`user_id\`, \`use_scene\`),
        KEY \`idx_user_id\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户Listing常用后缀'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TABLE IF EXISTS `app_user_listing_common_suffix`'
    );
  }
}
