package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingListing;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * 领星亚马逊 Listing Mapper。
 * <p>沿用老约定放在 com.sjzm.product.mapper，已被 ProductApplication.@MapperScan 第一行覆盖，无需改 @MapperScan。
 */
public interface LingxingListingMapper extends BaseMapper<LingxingListing> {

    /**
     * 取「统一表目标 ASIN 实际分布的店铺 sid」列表（去重）。
     *
     * <p><b>动态实时计算，不是固定店铺清单</b>：本查询在同步流程里、周表与统一表「刚重建之后」执行，
     * 数据源为周表 {@code lingxing_sku_weekly_performance}（sid+asin 对）∩ 统一表 {@code lingxing_product_unified}（目标标签 ASIN）。
     * 因两张表都在本次 run 内刚刷新，若本周新增店铺、且其货打了目标标签，其 sid 会被自动算进来；
     * 反之退出目标标签的 ASIN 所在店铺若无其他目标 ASIN，也会自动移除。实测某周为 18 家，仅是当次观测值，非写死。</p>
     *
     * <p>为何收窄到目标店而非 228 家在售店：listing 接口 sid 支持逗号分隔多店一次查（文档 {@code "sid":"1,16"}）、
     * asin 搜索每批上限 10。目标 ASIN 高度集中在少数店，取这批 sid 合并成逗号串全局分页拉、白名单过滤，
     * 比合并 228 家（拉回大量非目标行）或按 asin 每批 10 个（~700 批）都快；
     * 且逻辑上不漏——ASIN 能进统一表的前提是它在周表有记录，故其所在店 sid 必在结果内。</p>
     */
    @Select("""
            SELECT DISTINCT w.sid
            FROM lingxing_sku_weekly_performance w
            WHERE w.sid IS NOT NULL
              AND w.asin IN (SELECT asin FROM lingxing_product_unified)
            """)
    List<Long> selectTargetSids();
}
