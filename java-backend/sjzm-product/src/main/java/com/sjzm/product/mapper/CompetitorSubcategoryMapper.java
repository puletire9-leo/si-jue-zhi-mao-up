package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.CompetitorSubcategory;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface CompetitorSubcategoryMapper extends BaseMapper<CompetitorSubcategory> {

    /** 批量插入子类别 */
    int insertBatch(@Param("list") List<CompetitorSubcategory> list);

    /** 按产品ID批量查询子类别 */
    List<CompetitorSubcategory> selectByProductIds(@Param("productIds") List<Long> productIds);
}
