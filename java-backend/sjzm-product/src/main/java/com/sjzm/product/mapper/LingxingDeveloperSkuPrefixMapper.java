package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingDeveloperSkuPrefix;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * Developer SKU prefix mapping — rebuilt weekly from unified table.
 */
@Mapper
public interface LingxingDeveloperSkuPrefixMapper extends BaseMapper<LingxingDeveloperSkuPrefix> {

    /** Truncate and rebuild from unified table. */
    @Delete("DELETE FROM lingxing_developer_sku_prefix")
    int truncate();

    /**
     * Insert one prefix mapping row.
     * Uses INSERT ... ON DUPLICATE KEY UPDATE to be idempotent.
     */
    @Insert("""
            INSERT INTO lingxing_developer_sku_prefix (developer, sku_prefix, asin_count, updated_at)
            VALUES (#{row.developer}, #{row.skuPrefix}, #{row.asinCount}, NOW())
            ON DUPLICATE KEY UPDATE
              asin_count = VALUES(asin_count),
              updated_at = NOW()
            """)
    int upsertPrefix(@Param("row") LingxingDeveloperSkuPrefix row);

    /** Find all developers having a given prefix. */
    @Select("SELECT developer FROM lingxing_developer_sku_prefix WHERE sku_prefix = #{prefix}")
    List<String> findDevelopersByPrefix(@Param("prefix") String skuPrefix);

    /** Load all prefix mappings into a list. */
    @Select("SELECT developer, sku_prefix FROM lingxing_developer_sku_prefix ORDER BY developer, sku_prefix")
    List<LingxingDeveloperSkuPrefix> selectAllPrefixes();
}
