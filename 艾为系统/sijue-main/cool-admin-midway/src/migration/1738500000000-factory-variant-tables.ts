import { MigrationInterface, QueryRunner } from 'typeorm';
import { Provide } from '@midwayjs/decorator';
import { v4 as uuid } from 'uuid';

/**
 * BSR 选品：工厂链接、变体独立成表，软删除
 */
@Provide()
export class FactoryVariantTables1738540000000 implements MigrationInterface {
  name = 'FactoryVariantTables1738540000000';

  private toArray(value: unknown): any[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  private toSafeString(value: unknown, maxLen?: number): string {
    const str = value == null ? '' : String(value);
    return maxLen ? str.slice(0, maxLen) : str;
  }

  private toSafeNullableString(value: unknown, maxLen?: number): string | null {
    if (value == null) return null;
    const str = String(value).trim();
    if (!str) return null;
    return maxLen ? str.slice(0, maxLen) : str;
  }

  private toSafeInt(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value === 'string') {
      const num = Number(value.trim());
      if (Number.isFinite(num)) return Math.trunc(num);
    }
    return fallback;
  }

  private toSafeDecimal(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Number(value.toFixed(2));
    }
    const raw = value == null ? '' : String(value).trim().replace(/,/g, '');
    if (!raw) return fallback;
    let cleaned = raw.replace(/[^\d.-]/g, '');
    cleaned = cleaned.replace(/(?!^)-/g, '');
    const dotIndex = cleaned.indexOf('.');
    if (dotIndex !== -1) {
      cleaned = cleaned.slice(0, dotIndex + 1) + cleaned.slice(dotIndex + 1).replace(/\./g, '');
    }
    if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return fallback;
    const num = Number(cleaned);
    if (!Number.isFinite(num)) return fallback;
    return Number(num.toFixed(2));
  }

  private toSafeUuidLike(value: unknown): string {
    const v = this.toSafeString(value, 36).trim();
    return v || uuid();
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 放宽当前会话 SQL mode，避免极端脏值触发 strict 模式中断整条迁移
    await queryRunner.query(`
      SET SESSION sql_mode = REPLACE(
        REPLACE(@@SESSION.sql_mode, 'STRICT_TRANS_TABLES', ''),
        'STRICT_ALL_TABLES', ''
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_amz_bsr_candidate_factory_link\` (
        \`id\` varchar(36) NOT NULL COMMENT 'UUID',
        \`candidate_id\` int NOT NULL COMMENT '选品 id',
        \`name\` varchar(200) NOT NULL DEFAULT '' COMMENT '品名',
        \`type\` varchar(32) NOT NULL DEFAULT 'main' COMMENT '类型 main/accessory/packing',
        \`price\` decimal(10,2) NOT NULL DEFAULT 0 COMMENT '价格',
        \`user_input\` varchar(512) NOT NULL DEFAULT '' COMMENT '链接 URL',
        \`user_input_description\` varchar(512) NOT NULL DEFAULT '' COMMENT '链接描述',
        \`product_sku\` varchar(64) DEFAULT NULL COMMENT '产品 SKU',
        \`supplier_sku\` varchar(64) DEFAULT NULL COMMENT '供应商 SKU',
        \`product_name\` varchar(255) DEFAULT NULL COMMENT '产品名称',
        \`sort_order\` int NOT NULL DEFAULT 0 COMMENT '排序',
        \`createTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updateTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` datetime(6) DEFAULT NULL COMMENT '软删除时间',
        PRIMARY KEY (\`id\`),
        KEY \`idx_candidate_id\` (\`candidate_id\`),
        KEY \`idx_deleted_at\` (\`deleted_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='BSR选品-工厂链接'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_amz_bsr_candidate_variant\` (
        \`id\` varchar(36) NOT NULL COMMENT 'UUID',
        \`candidate_id\` int NOT NULL COMMENT '选品 id',
        \`name\` varchar(200) NOT NULL DEFAULT '' COMMENT '变体名称',
        \`description\` text DEFAULT NULL COMMENT '变体描述',
        \`quantity\` int NOT NULL DEFAULT 0 COMMENT '采购数量',
        \`group_proportions\` json DEFAULT NULL COMMENT '工厂链接配比 {factory_link_id: proportion}',
        \`sort_order\` int NOT NULL DEFAULT 0 COMMENT '排序',
        \`createTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updateTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` datetime(6) DEFAULT NULL COMMENT '软删除时间',
        PRIMARY KEY (\`id\`),
        KEY \`idx_candidate_id\` (\`candidate_id\`),
        KEY \`idx_deleted_at\` (\`deleted_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='BSR选品-变体'
    `);

    // 数据迁移：从 candidate 的 JSON 写入新表
    const rows = await queryRunner.query(
      'SELECT id, factory_links, variant_Combination FROM app_amz_bsr_candidate'
    );
    for (const row of rows as Array<{ id: number; factory_links: unknown; variant_Combination: unknown }>) {
      const candidateId = this.toSafeInt(row.id);
      if (!candidateId) continue;

      // redo 安全：以 candidate_id 为粒度重建新表数据，避免重复灌入
      await queryRunner.query(
        'DELETE FROM app_amz_bsr_candidate_factory_link WHERE candidate_id = ?',
        [candidateId]
      );
      await queryRunner.query(
        'DELETE FROM app_amz_bsr_candidate_variant WHERE candidate_id = ?',
        [candidateId]
      );

      const factoryLinks = this.toArray(row.factory_links);
      const variantCombination = this.toArray(row.variant_Combination);

      const nameToLinkId: Record<string, string> = {};
      for (let i = 0; i < factoryLinks.length; i++) {
        const link = factoryLinks[i];
        if (!link || typeof link !== 'object') continue;
        const linkId = uuid();
        const linkName = this.toSafeString((link as any).name, 200);
        try {
          await queryRunner.query(
            `INSERT INTO app_amz_bsr_candidate_factory_link (
              id, candidate_id, name, type, price, user_input, user_input_description,
              product_sku, supplier_sku, product_name, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              linkId,
              candidateId,
              linkName,
              this.toSafeString((link as any).type || 'main', 32),
              this.toSafeDecimal((link as any).price, 0),
              this.toSafeString((link as any).user_input, 512),
              this.toSafeString((link as any).user_input_description, 512),
              this.toSafeNullableString((link as any).productSKU, 64),
              this.toSafeNullableString((link as any).supplierSKU, 64),
              this.toSafeNullableString((link as any).product_name, 255),
              i,
            ]
          );
          if (linkName) nameToLinkId[linkName] = linkId;
        } catch (error) {
          // 单条脏数据跳过，避免中断整批迁移
          console.warn(
            `[migration:${this.name}] skip factory_link candidate_id=${candidateId} index=${i} reason=${(error as Error).message}`
          );
        }
      }

      for (let i = 0; i < variantCombination.length; i++) {
        const v = variantCombination[i];
        if (!v || typeof v !== 'object') continue;
        const variantId = this.toSafeUuidLike((v as any).id);
        const rawGroupProportions = (v as any).groupProportions;
        const groupProportions =
          rawGroupProportions && typeof rawGroupProportions === 'object' ? rawGroupProportions : {};
        const group_proportions = Object.entries(groupProportions).reduce(
          (acc: Record<string, number>, [name, value]) => {
            const linkId = nameToLinkId[name];
            if (linkId) acc[linkId] = this.toSafeDecimal(value, 1);
            return acc;
          },
          {}
        );
        try {
          await queryRunner.query(
            `INSERT INTO app_amz_bsr_candidate_variant (id, candidate_id, name, description, quantity, group_proportions, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              variantId,
              candidateId,
              this.toSafeString((v as any).name, 200),
              this.toSafeNullableString((v as any).description),
              this.toSafeInt((v as any).quantity, 0),
              JSON.stringify(group_proportions),
              i,
            ]
          );
        } catch (error) {
          // 单条脏数据跳过，避免中断整批迁移
          console.warn(
            `[migration:${this.name}] skip variant candidate_id=${candidateId} index=${i} reason=${(error as Error).message}`
          );
        }
      }
    }

    // 兼容迁移执行顺序：如果采购表已存在 selected_variant_id 字段，这里补一次回填
    const [{ db: dbName }] = await queryRunner.query(`SELECT DATABASE() as db`) as { db: string }[];
    const purchaserTable = 'app_amz_bsr_candidate_purchaser';
    const purchaserExists = await queryRunner.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [dbName, purchaserTable]
    ) as Array<{ TABLE_NAME: string }>;
    if (purchaserExists.length > 0) {
      const purchaserColumns = await queryRunner.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [dbName, purchaserTable]
      ) as Array<{ COLUMN_NAME: string }>;
      const purchaserColumnSet = new Set(purchaserColumns.map((c) => c.COLUMN_NAME));
      if (purchaserColumnSet.has('selected_variant_id') && purchaserColumnSet.has('selectedVariant')) {
        const purchasers = await queryRunner.query(
          `SELECT id, candidate_id, selectedVariant FROM app_amz_bsr_candidate_purchaser
           WHERE selectedVariant IS NOT NULL AND selectedVariant != ''
             AND (selected_variant_id IS NULL OR selected_variant_id = '')`
        ) as Array<{ id: number; candidate_id: unknown; selectedVariant: unknown }>;
        for (const p of purchasers) {
          const candidateId = this.toSafeInt(p.candidate_id);
          const selectedVariant = p.selectedVariant == null ? '' : String(p.selectedVariant).trim();
          if (!candidateId || !selectedVariant) continue;
          const variantRows = await queryRunner.query(
            `SELECT id FROM app_amz_bsr_candidate_variant
             WHERE candidate_id = ? AND name = ? AND deleted_at IS NULL
             ORDER BY sort_order ASC LIMIT 1`,
            [candidateId, selectedVariant]
          ) as Array<{ id: string }>;
          if (variantRows.length > 0) {
            await queryRunner.query(
              `UPDATE app_amz_bsr_candidate_purchaser
               SET selected_variant_id = ?
               WHERE id = ? AND (selected_variant_id IS NULL OR selected_variant_id = '')`,
              [variantRows[0].id, p.id]
            );
          }
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS app_amz_bsr_candidate_variant`);
    await queryRunner.query(`DROP TABLE IF EXISTS app_amz_bsr_candidate_factory_link`);
  }
}
