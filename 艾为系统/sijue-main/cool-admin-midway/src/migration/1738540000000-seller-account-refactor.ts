import { MigrationInterface, QueryRunner } from 'typeorm';
import { Provide } from '@midwayjs/decorator';

/**
 * 关联统一到店铺账号（seller_account_id）：
 * - purchaser: seller_id/seller_name -> seller_account_id/account_name
 * - msku: seller_id/seller_name -> seller_account_id/account_name，唯一键改为 (candidate_id, seller_account_id, selected_variant)，同账号多站点合并为一条
 * - design_task_picture: seller_id -> seller_account_id
 * - design_upload_task: final_shop -> final_account（存 seller_account_id）
 */
@Provide()
export class SellerAccountRefactor1738540000000 implements MigrationInterface {
  name = 'SellerAccountRefactor1738540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ db: dbName }] = (await queryRunner.query(`SELECT DATABASE() as db`)) as { db: string }[];

    // ---------- 1. app_amz_bsr_candidate_purchaser ----------
    const purchaserCols = (await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'app_amz_bsr_candidate_purchaser'`,
      [dbName]
    )) as { COLUMN_NAME: string }[];
    const purchaserHas = (name: string) => purchaserCols.some((c) => c.COLUMN_NAME === name);

    if (!purchaserHas('seller_account_id')) {
      await queryRunner.query(
        `ALTER TABLE \`app_amz_bsr_candidate_purchaser\` ADD \`seller_account_id\` varchar(64) NULL COMMENT '店铺账号 id'`
      );
    }
    if (!purchaserHas('account_name')) {
      await queryRunner.query(
        `ALTER TABLE \`app_amz_bsr_candidate_purchaser\` ADD \`account_name\` varchar(255) NULL COMMENT '店铺账户名称'`
      );
    }
    if (purchaserHas('seller_id')) {
      await queryRunner.query(`
        UPDATE \`app_amz_bsr_candidate_purchaser\` p
        INNER JOIN \`app_amz_seller\` s ON s.seller_id COLLATE utf8mb4_unicode_ci = p.seller_id
        SET p.seller_account_id = CAST(s.seller_account_id AS CHAR), p.account_name = s.account_name
        WHERE p.seller_id IS NOT NULL AND p.seller_id != ''
      `);
      await queryRunner.query(`ALTER TABLE \`app_amz_bsr_candidate_purchaser\` DROP COLUMN \`seller_id\``);
    }
    if (purchaserHas('seller_name')) {
      await queryRunner.query(`ALTER TABLE \`app_amz_bsr_candidate_purchaser\` DROP COLUMN \`seller_name\``);
    }

    // ---------- 2. app_amz_msku ----------
    const mskuCols = (await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'app_amz_msku'`,
      [dbName]
    )) as { COLUMN_NAME: string }[];
    const mskuHas = (name: string) => mskuCols.some((c) => c.COLUMN_NAME === name);

    if (!mskuHas('seller_account_id')) {
      await queryRunner.query(
        `ALTER TABLE \`app_amz_msku\` ADD \`seller_account_id\` varchar(64) NULL COMMENT '店铺账号 id'`
      );
    }
    if (!mskuHas('account_name')) {
      await queryRunner.query(
        `ALTER TABLE \`app_amz_msku\` ADD \`account_name\` varchar(255) NULL COMMENT '店铺账户名称'`
      );
    }
    if (mskuHas('seller_id')) {
      await queryRunner.query(`
        UPDATE \`app_amz_msku\` m
        INNER JOIN \`app_amz_seller\` s ON s.seller_id COLLATE utf8mb4_unicode_ci = m.seller_id
        SET m.seller_account_id = CAST(s.seller_account_id AS CHAR), m.account_name = s.account_name
        WHERE m.seller_id IS NOT NULL AND m.seller_id != ''
      `);
    }

    // MSKU 合并：同 (candidate_id, seller_account_id, selected_variant) 保留一条（msku 最小的），其余合并到该条并删掉重复 msku 行
    const dupGroups = (await queryRunner.query(
      `SELECT candidate_id, seller_account_id, selected_variant FROM app_amz_msku
       WHERE seller_account_id IS NOT NULL AND seller_account_id != ''
       GROUP BY candidate_id, seller_account_id, selected_variant HAVING COUNT(*) > 1`
    )) as { candidate_id: string; seller_account_id: string; selected_variant: string }[];

    for (const g of dupGroups) {
      const rows = (await queryRunner.query(
        `SELECT msku FROM app_amz_msku WHERE candidate_id = ? AND seller_account_id = ? AND selected_variant = ? ORDER BY msku ASC`,
        [g.candidate_id, g.seller_account_id, g.selected_variant]
      )) as { msku: string }[];
      const keepMsku = rows[0].msku;
      const dropMskus = rows.slice(1).map((r) => r.msku);
      for (const dropMsku of dropMskus) {
        const uploadTasks = (await queryRunner.query(
          `SELECT id, design_task_id FROM design_upload_task WHERE msku = ?`,
          [dropMsku]
        )) as { id: number; design_task_id: number }[];
        for (const ut of uploadTasks) {
          const keptTask = (await queryRunner.query(
            `SELECT id FROM design_upload_task WHERE design_task_id = ? AND msku = ? LIMIT 1`,
            [ut.design_task_id, keepMsku]
          )) as { id: number }[];
          if (keptTask.length > 0) {
            const keptId = keptTask[0].id;
            const moved = (await queryRunner.query(
              `SELECT picture_id FROM design_upload_task_picture WHERE upload_task_id = ?`,
              [ut.id]
            )) as { picture_id: number }[];
            for (const row of moved) {
              const exists = (await queryRunner.query(
                `SELECT 1 FROM design_upload_task_picture WHERE upload_task_id = ? AND picture_id = ? LIMIT 1`,
                [keptId, row.picture_id]
              )) as unknown[];
              if (exists.length === 0) {
                await queryRunner.query(
                  `UPDATE design_upload_task_picture SET upload_task_id = ? WHERE upload_task_id = ? AND picture_id = ?`,
                  [keptId, ut.id, row.picture_id]
                );
              } else {
                await queryRunner.query(
                  `DELETE FROM design_upload_task_picture WHERE upload_task_id = ? AND picture_id = ?`,
                  [ut.id, row.picture_id]
                );
              }
            }
            await queryRunner.query(`DELETE FROM design_upload_task_picture WHERE upload_task_id = ?`, [ut.id]);
            await queryRunner.query(`DELETE FROM design_upload_task WHERE id = ?`, [ut.id]);
          } else {
            await queryRunner.query(`UPDATE design_upload_task SET msku = ? WHERE id = ?`, [keepMsku, ut.id]);
          }
        }
        await queryRunner.query(`UPDATE design_task_picture SET msku = ? WHERE msku = ?`, [keepMsku, dropMsku]);
        await queryRunner.query(`DELETE FROM app_amz_msku WHERE msku = ?`, [dropMsku]);
      }
    }

    if (mskuHas('seller_id')) {
      await queryRunner.query(`ALTER TABLE \`app_amz_msku\` DROP INDEX \`UQ_candidate_seller_variant\``);
      await queryRunner.query(`ALTER TABLE \`app_amz_msku\` DROP COLUMN \`seller_id\``);
    }
    if (mskuHas('seller_name')) {
      await queryRunner.query(`ALTER TABLE \`app_amz_msku\` DROP COLUMN \`seller_name\``);
    }
    const mskuUnique = (await queryRunner.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'app_amz_msku' AND INDEX_NAME = 'UQ_candidate_account_variant'`,
      [dbName]
    )) as { INDEX_NAME: string }[];
    if (mskuUnique.length === 0) {
      await queryRunner.query(
        `ALTER TABLE \`app_amz_msku\` ADD UNIQUE KEY \`UQ_candidate_account_variant\` (\`candidate_id\`, \`seller_account_id\`, \`selected_variant\`)`
      );
    }

    // ---------- 3. design_task_picture ----------
    const picCols = (await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'design_task_picture'`,
      [dbName]
    )) as { COLUMN_NAME: string }[];
    const picHas = (name: string) => picCols.some((c) => c.COLUMN_NAME === name);

    if (!picHas('seller_account_id')) {
      await queryRunner.query(
        `ALTER TABLE \`design_task_picture\` ADD \`seller_account_id\` varchar(64) NULL COMMENT '店铺账号 id（场景图等挂载用）'`
      );
    }
    if (picHas('seller_id')) {
      await queryRunner.query(`
        UPDATE \`design_task_picture\` p
        INNER JOIN \`app_amz_seller\` s ON s.seller_id COLLATE utf8mb4_unicode_ci = p.seller_id
        SET p.seller_account_id = CAST(s.seller_account_id AS CHAR)
        WHERE p.seller_id IS NOT NULL AND p.seller_id != ''
      `);
      await queryRunner.query(`ALTER TABLE \`design_task_picture\` DROP INDEX \`idx_seller_id\``);
      await queryRunner.query(`ALTER TABLE \`design_task_picture\` DROP COLUMN \`seller_id\``);
    }
    const picIdx = (await queryRunner.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'design_task_picture' AND INDEX_NAME = 'idx_seller_account_id'`,
      [dbName]
    )) as { INDEX_NAME: string }[];
    if (picIdx.length === 0) {
      await queryRunner.query(
        `ALTER TABLE \`design_task_picture\` ADD KEY \`idx_seller_account_id\` (\`seller_account_id\`)`
      );
    }

    // ---------- 4. design_upload_task: final_shop -> final_account ----------
    const utCols = (await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'design_upload_task'`,
      [dbName]
    )) as { COLUMN_NAME: string }[];
    const utHas = (name: string) => utCols.some((c) => c.COLUMN_NAME === name);

    if (!utHas('final_account')) {
      await queryRunner.query(
        `ALTER TABLE \`design_upload_task\` ADD \`final_account\` varchar(64) NOT NULL DEFAULT '' COMMENT '最终上传店铺账号 id（seller_account_id）'`
      );
    }
    if (utHas('final_shop')) {
      // 回填：final_shop 若为 seller_id，通过 app_amz_seller 解析为 seller_account_id
      await queryRunner.query(`
        UPDATE \`design_upload_task\` ut
        INNER JOIN \`app_amz_seller\` s ON s.seller_id COLLATE utf8mb4_unicode_ci = TRIM(ut.final_shop) COLLATE utf8mb4_unicode_ci
        SET ut.final_account = CAST(s.seller_account_id AS CHAR)
        WHERE ut.final_shop IS NOT NULL AND TRIM(ut.final_shop) != ''
      `);
      // 未匹配到 seller_id 的，尝试按 account_name 匹配（final_shop 可能存的是账号名）
      await queryRunner.query(`
        UPDATE \`design_upload_task\` ut
        INNER JOIN \`app_amz_seller\` s ON (s.account_name COLLATE utf8mb4_unicode_ci = TRIM(ut.final_shop) COLLATE utf8mb4_unicode_ci OR s.name COLLATE utf8mb4_unicode_ci = TRIM(ut.final_shop) COLLATE utf8mb4_unicode_ci)
        SET ut.final_account = CAST(s.seller_account_id AS CHAR)
        WHERE ut.final_account = '' AND ut.final_shop IS NOT NULL AND TRIM(ut.final_shop) != ''
      `);
      await queryRunner.query(`ALTER TABLE \`design_upload_task\` DROP COLUMN \`final_shop\``);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ db: dbName }] = (await queryRunner.query(`SELECT DATABASE() as db`)) as { db: string }[];

    if (dbName === undefined) return;

    await queryRunner.query(
      `ALTER TABLE \`design_upload_task\` ADD \`final_shop\` varchar(255) NOT NULL DEFAULT '' COMMENT '最终上传店铺记录'`
    );
    await queryRunner.query(`ALTER TABLE \`design_upload_task\` DROP COLUMN \`final_account\``);

    await queryRunner.query(
      `ALTER TABLE \`design_task_picture\` ADD \`seller_id\` varchar(64) DEFAULT NULL COMMENT '店铺层级关联'`
    );
    await queryRunner.query(`ALTER TABLE \`design_task_picture\` DROP INDEX \`idx_seller_account_id\``);
    await queryRunner.query(`ALTER TABLE \`design_task_picture\` DROP COLUMN \`seller_account_id\``);

    await queryRunner.query(`ALTER TABLE \`app_amz_msku\` ADD \`seller_id\` varchar(64) NULL COMMENT '卖家ID'`);
    await queryRunner.query(`ALTER TABLE \`app_amz_msku\` ADD \`seller_name\` varchar(255) NULL COMMENT '卖家账户名称'`);
    await queryRunner.query(`ALTER TABLE \`app_amz_msku\` DROP INDEX \`UQ_candidate_account_variant\``);
    await queryRunner.query(
      `ALTER TABLE \`app_amz_msku\` ADD UNIQUE KEY \`UQ_candidate_seller_variant\` (\`candidate_id\`, \`seller_id\`, \`selected_variant\`)`
    );
    await queryRunner.query(`ALTER TABLE \`app_amz_msku\` DROP COLUMN \`seller_account_id\``);
    await queryRunner.query(`ALTER TABLE \`app_amz_msku\` DROP COLUMN \`account_name\``);

    await queryRunner.query(`ALTER TABLE \`app_amz_bsr_candidate_purchaser\` ADD \`seller_id\` varchar(255) NULL COMMENT '卖家ID'`);
    await queryRunner.query(
      `ALTER TABLE \`app_amz_bsr_candidate_purchaser\` ADD \`seller_name\` varchar(255) NULL COMMENT '卖家账户名称'`
    );
    await queryRunner.query(`ALTER TABLE \`app_amz_bsr_candidate_purchaser\` DROP COLUMN \`seller_account_id\``);
    await queryRunner.query(`ALTER TABLE \`app_amz_bsr_candidate_purchaser\` DROP COLUMN \`account_name\``);
  }
}
