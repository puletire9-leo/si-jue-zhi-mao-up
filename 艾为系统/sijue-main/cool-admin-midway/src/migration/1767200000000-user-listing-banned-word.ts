import { MigrationInterface, QueryRunner } from 'typeorm';
import { Provide } from '@midwayjs/decorator';

@Provide()
export class UserListingBannedWord1767200000000 implements MigrationInterface {
  name = 'UserListingBannedWord1767200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_user_listing_banned_word\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`user_id\` int NOT NULL COMMENT '用户ID',
        \`word\` varchar(255) NOT NULL COMMENT '违禁词',
        \`reason\` varchar(500) DEFAULT NULL COMMENT '原因说明',
        \`sort_order\` int NOT NULL DEFAULT 0 COMMENT '排序（越小越靠前）',
        \`createTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updateTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_user_listing_banned_word\` (\`user_id\`, \`word\`),
        KEY \`idx_user_id\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户Listing违禁词库'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TABLE IF EXISTS `app_user_listing_banned_word`'
    );
  }
}
