package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.categorytree.entity.CategoryTreeNode;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 * 类目树节点 Mapper。
 * 放 com.sjzm.product.mapper（@MapperScan 只扫此包）。
 */
@Mapper
public interface CategoryTreeNodeMapper extends BaseMapper<CategoryTreeNode> {

    /**
     * 拉取新品榜原始行（构建树用）：每行 { asin, nodeIdPath, nodeLabelPath, bsrId }。
     * 只取指定站点、指定来源、且 node_label_path 非空的行。
     */
    @Select("SELECT asin AS asin, node_id_path AS nodeIdPath," +
            " node_label_path AS nodeLabelPath, bsr_id AS bsrId" +
            " FROM competitor_products" +
            " WHERE marketplace = #{marketplace} AND source = #{source}" +
            " AND node_label_path IS NOT NULL AND node_label_path <> ''")
    List<Map<String, Object>> selectRankingRows(@Param("marketplace") String marketplace,
                                                @Param("source") String source);

    /** 站点下有新品榜数据的所有 marketplace（刷新全部时用） */
    @Select("SELECT DISTINCT marketplace FROM competitor_products WHERE source = #{source}")
    List<String> selectMarketplacesWithRanking(@Param("source") String source);
}
