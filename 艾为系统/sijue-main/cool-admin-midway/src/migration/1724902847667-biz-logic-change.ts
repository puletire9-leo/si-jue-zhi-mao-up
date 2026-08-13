import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * 新增模块：BSR 类目排名过滤器（用于 BSR 榜单爬虫选品过滤）
 */
@Provide()
export class BizLogicChange1724902847667 implements MigrationInterface {
  name = 'BizLogicChange1724902847667'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE \`app_amz_bsr_department_rank_filter\` (
                \`id\` int NOT NULL AUTO_INCREMENT COMMENT 'ID',
                \`createTime\` datetime(6) NOT NULL COMMENT '创建时间' DEFAULT CURRENT_TIMESTAMP(6),
                \`updateTime\` datetime(6) NOT NULL COMMENT '更新时间' DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`marketplace\` varchar(20) NOT NULL COMMENT '站点',
                \`department\` varchar(255) NOT NULL COMMENT '类目名称',
                \`rank_limit\` int NULL COMMENT '排名（不低于）',
                INDEX \`IDX_68df191d3e6972d280ca009cb6\` (\`createTime\`),
                INDEX \`IDX_a1de32eef4573507beda3fe925\` (\`updateTime\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX \`IDX_a1de32eef4573507beda3fe925\` ON \`app_amz_bsr_department_rank_filter\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_68df191d3e6972d280ca009cb6\` ON \`app_amz_bsr_department_rank_filter\`
        `);
    await queryRunner.query(`
            DROP TABLE \`app_amz_bsr_department_rank_filter\`
        `);
  }

}
