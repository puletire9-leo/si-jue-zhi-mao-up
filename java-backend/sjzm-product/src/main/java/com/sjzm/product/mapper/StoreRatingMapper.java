package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.StoreRating;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface StoreRatingMapper extends BaseMapper<StoreRating> {

    /** 批量 UPSERT（seller_name + marketplace 唯一键） */
    int insertOrUpdateBatch(@Param("list") List<StoreRating> list);

    /** 按 marketplace 查询所有评级 */
    List<StoreRating> selectByMarketplace(@Param("marketplace") String marketplace);
}
