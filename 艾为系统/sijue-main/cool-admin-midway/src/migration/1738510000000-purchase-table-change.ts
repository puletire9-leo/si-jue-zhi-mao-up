import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * BSR 选品采购管理：增加卖家相关字段 seller_id、seller_name；增加 selected_variant_id，按变体 id 定位采购变体（selectedVariant 保留冗余）
 */
@Provide()
export class BizLogicChange1738500000000 implements MigrationInterface {
  name = 'BizLogicChange1738500000000'

  private toSafeInt(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value === 'string') {
      const num = Number(value.trim());
      if (Number.isFinite(num)) return Math.trunc(num);
    }
    return null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = 'app_amz_bsr_candidate_purchaser';
    const [{ db: dbName }] = await queryRunner.query(`SELECT DATABASE() as db`) as { db: string }[];
    const tableRows = await queryRunner.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [dbName, table]
    ) as Array<{ TABLE_NAME: string }>;
    if (tableRows.length === 0) return;

    const cols = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [dbName, table]
    );
    const existing = new Set((cols as { COLUMN_NAME: string }[]).map((r) => r.COLUMN_NAME));
    const adds: string[] = [];
    if (!existing.has('seller_id')) adds.push('ADD `seller_id` varchar(255) NULL COMMENT \'卖家ID\'');
    if (!existing.has('seller_name')) adds.push('ADD `seller_name` varchar(255) NULL COMMENT \'卖家账户名称\'');
    if (!existing.has('selected_variant_id')) adds.push('ADD `selected_variant_id` varchar(36) NULL COMMENT \'选中的变体 id（app_amz_bsr_candidate_variant.id）\'');
    if (adds.length > 0) {
      await queryRunner.query(`ALTER TABLE \`${table}\` ${adds.join(', ')}`);
    }

    const variantTableRows = await queryRunner.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [dbName, 'app_amz_bsr_candidate_variant']
    ) as Array<{ TABLE_NAME: string }>;
    if (variantTableRows.length === 0) return;

    // 回填 selected_variant_id：按 candidate_id + selectedVariant(name) 匹配变体表，同名取第一条（按 sort_order）
    const purchasers = await queryRunner.query(
      `SELECT id, candidate_id, selectedVariant FROM app_amz_bsr_candidate_purchaser WHERE selectedVariant IS NOT NULL AND selectedVariant != ''`
    );
    for (const p of purchasers) {
      const candidateId = this.toSafeInt(p.candidate_id);
      const selectedVariant = p.selectedVariant == null ? '' : String(p.selectedVariant).trim();
      if (!candidateId || !selectedVariant) continue;
      const rows = await queryRunner.query(
        `SELECT id FROM app_amz_bsr_candidate_variant WHERE candidate_id = ? AND name = ? AND deleted_at IS NULL ORDER BY sort_order ASC LIMIT 1`,
        [candidateId, selectedVariant]
      );
      if (rows.length > 0) {
        await queryRunner.query(
          `UPDATE app_amz_bsr_candidate_purchaser SET selected_variant_id = ? WHERE id = ? AND (selected_variant_id IS NULL OR selected_variant_id = '')`,
          [rows[0].id, p.id]
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = 'app_amz_bsr_candidate_purchaser';
    const [{ db: dbName }] = await queryRunner.query(`SELECT DATABASE() as db`) as { db: string }[];
    const cols = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [dbName, table]
    ) as Array<{ COLUMN_NAME: string }>;
    const existing = new Set(cols.map((r) => r.COLUMN_NAME));
    const drops: string[] = [];
    if (existing.has('seller_id')) drops.push('DROP COLUMN `seller_id`');
    if (existing.has('seller_name')) drops.push('DROP COLUMN `seller_name`');
    if (existing.has('selected_variant_id')) drops.push('DROP COLUMN `selected_variant_id`');
    if (drops.length > 0) {
      await queryRunner.query(`ALTER TABLE \`${table}\` ${drops.join(', ')}`);
    }
  }

}
