import { MigrationInterface, QueryRunner } from 'typeorm';
import { Provide } from '@midwayjs/decorator';

@Provide()
export class DesignTaskPictureCopiesJson1767100000000 implements MigrationInterface {
  name = 'DesignTaskPictureCopiesJson1767100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ db: dbName }] = (await queryRunner.query(`SELECT DATABASE() as db`)) as { db: string }[];
    if (!dbName) return;

    const columns = (await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'design_task_picture'`,
      [dbName]
    )) as { COLUMN_NAME: string }[];
    const hasColumn = (name: string) => columns.some(column => column.COLUMN_NAME === name);

    if (!hasColumn('copies')) {
      await queryRunner.query(
        `ALTER TABLE \`design_task_picture\` ADD COLUMN \`copies\` JSON NULL COMMENT '图需多语言文案数组，数组顺序即展示顺序' AFTER \`remark_doc\``
      );
    }

    const tables = (await queryRunner.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'design_task_picture_caption'`,
      [dbName]
    )) as { TABLE_NAME: string }[];
    if (tables.length === 0) return;

    // 逐行读取再按 picture_id 聚合，避免 JSON_ARRAYAGG(... ORDER BY ...) 在低版本 MySQL 上不兼容
    const captionRows = (await queryRunner.query(`
      SELECT
        c.\`picture_id\` AS picture_id,
        c.\`raw_text\` AS raw_text,
        c.\`raw_after_rephrase\` AS raw_after_rephrase,
        c.\`role\` AS role,
        c.\`zh\` AS zh,
        c.\`uk\` AS uk,
        c.\`de\` AS de,
        c.\`fr\` AS fr,
        c.\`it\` AS it,
        c.\`es\` AS es
      FROM \`design_task_picture_caption\` c
      INNER JOIN \`design_task_picture\` p ON p.\`id\` = c.\`picture_id\`
      ORDER BY c.\`picture_id\` ASC, c.\`id\` ASC
    `)) as Array<Record<string, unknown>>;

    const copiesByPictureId = new Map<number, Array<Record<string, string>>>();
    for (const row of captionRows) {
      const pictureId = Number(row.picture_id);
      if (!pictureId) continue;
      const copy = {
        raw_text: row.raw_text == null ? '' : String(row.raw_text),
        raw_after_rephrase: row.raw_after_rephrase == null ? '' : String(row.raw_after_rephrase),
        role: row.role == null ? '' : String(row.role),
        zh: row.zh == null ? '' : String(row.zh),
        uk: row.uk == null ? '' : String(row.uk),
        de: row.de == null ? '' : String(row.de),
        fr: row.fr == null ? '' : String(row.fr),
        it: row.it == null ? '' : String(row.it),
        es: row.es == null ? '' : String(row.es),
      };
      const list = copiesByPictureId.get(pictureId) || [];
      list.push(copy);
      copiesByPictureId.set(pictureId, list);
    }

    for (const [pictureId, copies] of copiesByPictureId.entries()) {
      await queryRunner.query(
        `UPDATE \`design_task_picture\`
         SET \`copies\` = ?
         WHERE \`id\` = ?
           AND (\`copies\` IS NULL OR JSON_LENGTH(\`copies\`) = 0)`,
        [JSON.stringify(copies), pictureId]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ db: dbName }] = (await queryRunner.query(`SELECT DATABASE() as db`)) as { db: string }[];
    if (!dbName) return;

    const columns = (await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'design_task_picture'`,
      [dbName]
    )) as { COLUMN_NAME: string }[];
    const hasColumn = (name: string) => columns.some(column => column.COLUMN_NAME === name);

    if (hasColumn('copies')) {
      await queryRunner.query(`ALTER TABLE \`design_task_picture\` DROP COLUMN \`copies\``);
    }
  }
}
