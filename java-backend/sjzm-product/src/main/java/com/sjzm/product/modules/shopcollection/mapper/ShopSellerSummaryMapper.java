package com.sjzm.product.modules.shopcollection.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.shopcollection.entity.ShopSellerSummary;
import org.apache.ibatis.annotations.Mapper;

/**
 * 店铺聚合画像物化快照 Mapper。刷新用 BaseMapper 的 delete(按 marketplace) + insert(逐行)，
 * 读用 selectList(按 marketplace + productCount 过滤 + LIMIT)。
 * modules.shopcollection.mapper 已在 ProductApplication.@MapperScan 注册。
 */
@Mapper
public interface ShopSellerSummaryMapper extends BaseMapper<ShopSellerSummary> {
}