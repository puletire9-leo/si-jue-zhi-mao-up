import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * 新增 cookie 表
 */
@Provide()
export class BizLogicChange1716529505069 implements MigrationInterface {
  name = 'BizLogicChange1716529505069'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE \`app_amz_cookie\` (
                \`id\` int NOT NULL AUTO_INCREMENT COMMENT 'ID',
                \`createTime\` datetime(6) NOT NULL COMMENT '创建时间' DEFAULT CURRENT_TIMESTAMP(6),
                \`updateTime\` datetime(6) NOT NULL COMMENT '更新时间' DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`site\` varchar(255) NOT NULL COMMENT '站点' DEFAULT 'US',
                \`email\` varchar(255) NULL COMMENT '邮箱',
                \`username\` varchar(255) NULL COMMENT '用户名',
                \`password\` varchar(255) NULL COMMENT '密码',
                \`secret_2FA\` varchar(255) NULL COMMENT 'secret_2FA',
                \`content\` json NULL COMMENT '内容',
                \`isValid\` tinyint NOT NULL COMMENT '是否生效' DEFAULT '1',
                \`successCount\` int NULL COMMENT '成功次数' DEFAULT '0',
                \`failCount\` int NULL COMMENT '失败次数' DEFAULT '0',
                \`remark\` varchar(255) NULL COMMENT '备注',
                INDEX \`IDX_3f89e00315fa66060523eea815\` (\`createTime\`),
                INDEX \`IDX_0ece58f356e6cc0bfa8fd24901\` (\`updateTime\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX \`IDX_0ece58f356e6cc0bfa8fd24901\` ON \`app_amz_cookie\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_3f89e00315fa66060523eea815\` ON \`app_amz_cookie\`
        `);
    await queryRunner.query(`
            DROP TABLE \`app_amz_cookie\`
        `);
  }

}
