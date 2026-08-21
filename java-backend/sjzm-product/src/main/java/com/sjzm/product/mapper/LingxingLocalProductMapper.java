package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingLocalProduct;
import com.sjzm.product.rds.lingxing.LingxingRdsMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

/**
 * 领星本地产品 Mapper。
 * 放 com.sjzm.product.mapper（@MapperScan 只扫这个包）。
 */
@Mapper
public interface LingxingLocalProductMapper extends BaseMapper<LingxingLocalProduct>, LingxingRdsMapper {

    /** 统一表目标开发人数量（distinct，排除逗号组合名）。删非目标前的空集保护用。 */
    @Select("""
            SELECT COUNT(DISTINCT developer)
            FROM lingxing_product_unified
            WHERE developer IS NOT NULL AND developer <> '' AND developer NOT LIKE '%,%'
            """)
    int countTargetDevelopers();

    /**
     * 删除非目标开发人的本地产品行——只保留统一表目标开发人的 SKU。
     * <p>目标开发人 = 统一表 distinct developer（动态，排除逗号组合名）。
     * 无开发人/非目标一律删。覆盖更新：每周 syncAll 全量重拉后调用。
     * <p><b>调用前必须先 countTargetDevelopers()>0 判空</b>——否则 NOT IN 空集会删光全表。
     */
    @Delete("""
            DELETE FROM lingxing_local_product
            WHERE product_developer IS NULL OR product_developer = ''
               OR product_developer NOT IN (
                   SELECT DISTINCT developer FROM lingxing_product_unified
                   WHERE developer IS NOT NULL AND developer <> '' AND developer NOT LIKE '%,%'
               )
            """)
    int deleteNonTargetDevelopers();
}
